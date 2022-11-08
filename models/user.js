"use strict";

const db = require("../db");
const bcrypt = require("bcrypt");
const { sqlForPartialUpdate } = require("../helpers/sql");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");

const { BCRYPT_WORK_FACTOR } = require("../config.js");

/** Related functions for users. */

class User {
  /** authenticate user with username, password.
   *
   * Returns { username, first_name, last_name, email, is_admin }
   *
   * Throws UnauthorizedError is user not found or wrong password.
   **/

  static async authenticate(username, password) {
    // try to find the user first
    const result = await db.query(
          `SELECT username,
                  password,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin"
           FROM users
           WHERE username = $1`,
        [username],
    );

    const user = result.rows[0];

    if (user) {
      // compare hashed password to a new hash from password
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid === true) {
        delete user.password;
        return user;
      }
    }

    throw new UnauthorizedError("Invalid username/password");
  }

  /** Register user with data.
   *
   * Returns { username, firstName, lastName, email, isAdmin }
   *
   * Throws BadRequestError on duplicates.
   **/

  static async register(
      { username, password, firstName, lastName, email, isAdmin }) {
    const duplicateCheck = await db.query(
          `SELECT username
           FROM users
           WHERE username = $1`,
        [username],
    );

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate username: ${username}`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    const result = await db.query(
          `INSERT INTO users
           (username,
            password,
            first_name,
            last_name,
            email,
            is_admin)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING username, first_name AS "firstName", last_name AS "lastName", email, is_admin AS "isAdmin"`,
        [
          username,
          hashedPassword,
          firstName,
          lastName,
          email,
          isAdmin,
        ],
    );

    const user = result.rows[0];

    return user;
  }

  /** Find all users.
   *
   * Returns [{ username, first_name, last_name, email, is_admin }, ...]
   **/

  static async findAll() {
    const result = await db.query(
          `SELECT
                    users.username,
                    first_name AS "firstName",
                    last_name AS "lastName",
                    email,
                    is_admin AS "isAdmin",
                    job_id
            FROM users
            LEFT JOIN applications
            ON users.username = applications.username
           ORDER BY users.username`,
    );

    // JMT: begin modified code
    const resultRows = result.rows;

    // JMT: initialize jobs array to use in our forEach loop
    const jobs = [];
    // JMT: initialize allUsers array. we will return this final array of users
    const allUsers = [];
    
    resultRows.forEach((currObj,i) => {
      // push job_id to the job array
      jobs.push(currObj.job_id)

      /**
       *  JMT: if there is no next row, or the nextRow.username is different, 
       * than push the object to our array of all users
       */
      if (!result.rows[i+1] || currObj.username !== result.rows[i+1].username) {
        const { username, firstName, lastName, email, isAdmin } = currObj;
        /**
         * JMT: spread the jobs array because as we mutate the original w/ "push" 
         * the original array will also change in our finalUserObj that we push.
         * Since we are 0'ing the array at the final "round" it will also zero all
         * other references to that array in our allUsers list of objects!!!
         */
        const finalUserObj = { username, firstName, lastName, email, isAdmin, jobs: [...jobs] }
        allUsers.push(finalUserObj);
        jobs.length = 0;
      }
    });

    // JMT: return an array of users
    return allUsers;
  }

  /** Given a username, return data about user.
   *
   * Returns { username, first_name, last_name, is_admin, jobs }
   *   where jobs is { id, title, company_handle, company_name, state }
   *
   * Throws NotFoundError if user not found.
   **/

  static async get(username) {
    const userRes = await db.query(
         `SELECT
                  users.username,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin",
                  job_id
          FROM users
          LEFT JOIN applications
          ON users.username = applications.username
          WHERE users.username = $1;`,
        [username],
    );

    const user = userRes.rows[0];
    if (!user) throw new NotFoundError(`No user: ${username}`);

    const { firstName, lastName, email, isAdmin } = userRes.rows[0];

    const jobs = userRes.rows.map(r => r.job_id);

    return ({ username, firstName, lastName, email, isAdmin, jobs });
  }

  /** Update user data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain
   * all the fields; this only changes provided ones.
   *
   * Data can include:
   *   { firstName, lastName, password, email, isAdmin }
   *
   * Returns { username, firstName, lastName, email, isAdmin }
   *
   * Throws NotFoundError if not found.
   *
   * WARNING: this function can set a new password or make a user an admin.
   * Callers of this function must be certain they have validated inputs to this
   * or a serious security risks are opened.
   */

  static async update(username, data) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, BCRYPT_WORK_FACTOR);
    }
    /**
     * JMT:
     * 
     * setCols = a string of parameterized values, created in the sqlForPartialUpdate() func.
     * 
     * values = an array of values, created in the sqlForPartialUpdate() func.
     */
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          firstName: "first_name",
          lastName: "last_name",
          isAdmin: "is_admin",
        });
    /**
     * JMT: our parameterized idx will be +1 more than the number of values in our
     * db.query() values array because we are adding "username" to the values that
     * are submitted for update (see result variable below)
     */
    const usernameVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE users 
                      SET ${setCols} 
                      WHERE username = ${usernameVarIdx} 
                      RETURNING username,
                                first_name AS "firstName",
                                last_name AS "lastName",
                                email,
                                is_admin AS "isAdmin"`;
    // JMT: we are destructuring our "values" array from the above call to sqlForPartialUpdate
    const result = await db.query(querySql, [...values, username]);
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);

    delete user.password;
    return user;
  }

  /** Delete given user from database; returns undefined. */

  static async remove(username) {
    let result = await db.query(
          `DELETE
           FROM users
           WHERE username = $1
           RETURNING username`,
        [username],
    );
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);
  }

  /** Apply for a job (given user from database, and job_id); returns jobID. */

  static async applyForJob(username, jobId){
    // JMT: check if user exists
    const userCheck = await db.query(
      `SELECT username
       FROM users
       WHERE username = $1`,
       [username]);

    if (!userCheck.rows[0]) {
      throw new BadRequestError(`User not found`);
    }

    // JMT: check if job exists
    const jobCheck = await db.query(
      `SELECT id
       FROM jobs
       WHERE id = $1`,
       [jobId]);

    if (!jobCheck.rows[0]) {
      throw new BadRequestError(`Job not found`);
    }

    // JMT: check if application exists.
    const duplicateCheck = await db.query(
      `SELECT username, job_id
       FROM applications
       WHERE username = $1 and job_id = $2`,
       [username, jobId]);

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate application found`);
    }

    await db.query(
      `INSERT INTO applications (username, job_id)
       VALUES ($1, $2)
       RETURNING username, job_id
      `, [username, jobId]);

    return ({ applied: jobId })
  }
}


module.exports = User;
