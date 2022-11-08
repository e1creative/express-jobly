"use strict"

/**
 * JMT: create Job class model
 */

const db = require("../db");
const { NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for jobs. */

class Job {
  /** Create a job (from data), update db, return new job data.
   *
   * data should be { title, salary, equity, company_handle }
   *
   * Returns { title, salary, equity, company_handle }
   *
   * Throws BadRequestError if company already in database.
   * */

  static async create({title, salary, equity, company_handle}) {
    /**
     * JMT: commented out because we can't actually have dupes since each job is given a new id AUTO
     * and the SQL schema doesn't have any declared UNIQUE keys, so we could actually have the same
     * job description for the same company, UNLES WE CHANGE THE SCHEMA
     */
    // const duplicateCheck = await db.query(
    //      `SELECT company_handle
    //       FROM jobs
    //       WHERE title = $1`,
    //       [title]);

    // if (duplicateCheck.rows[0])
    //   throw new BadRequestError(`Duplicate job: ${title}`);

    const result = await db.query(
         `INSERT INTO jobs
          (title, salary, equity, company_handle)
          VALUES ($1, $2, $3, $4)
          RETURNING *`,
        [
          title,
          salary,
          equity,
          company_handle,
        ],
    );
    const job = result.rows[0];
    return job;
  }

  /** Find all companies.
   *
   * Returns [{ title, salary, equity, company_handle }, ...]
   * 
   * Filterable base on { titleLike, minSalary, hasEquity }
   * 
   * titleLike: filter by job title. Like before, this should be a case-insensitive, matches-any-part-of-string search.
   * 
   * minSalary: filter to jobs with at least that salary.
   * 
   * hasEquity: if true, filter to jobs that provide a non-zero amount of equity. 
   * 
   */

  static async findAll(filtersObj) {
    /**
     * JMT: check if the filterObj contains values.
     * 
     * If the filter object contains any values, check what values were passed and
     * create our filter parameters to add to our SQL query.
     * 
     * If it doesn't contain any values, continue on, and run the normal query
     */
    
    // JMT: initialize our variables
    let sqlWhereCondStr = ""; // JMT: will be inserted into our query
    let filterKeys; // JMT: used if our filtersObj contains any items
    let filterVals; // JMT: used if our filtersObj contains any items
    const values = []; // JMT: UNLINE companies and jobs, THIS will be passed to our query

    // JMT: if our filtersObj has a "filters:" entry and the value of "filters:" contains items...
    if (Object.keys(filtersObj).length > 0 && Object.keys(filtersObj.filters).length > 0) {

      /**
       * JMT: update our initialized filterKeys array with data from our passed "filters"
       * 
       * UNLINE the companies and users route, we may a boolean value in our filters.  we
       * can create a new array that removes the boolean value from our filterVals array
       * because we can't pass a boolean to our parameterized values array (it will error)
       */

      filterKeys = Object.keys(filtersObj.filters);
      filterVals = Object.values(filtersObj.filters);

      // JMT: initialize an array where we can store our WHERE conditions (later we combine them into a string)
      const sqlWhereCondArr = [];
      /**
       * JMT: loop throug the keys from our filters object.
       * 1. find the index and key using .entries()
       * 2. create our string based on the current key value with parameterized variable based on index of filterKeys
       * 3. push the corresponding value, based on index of filterKeys to our filterVals array
       */
      for (const [idx,key] of filterKeys.entries()){
        /**
         * JMT: the first iteration "key" will refer to the first "value" in our
         * filterValues array that we populated above.
         * 
         * UNLIKE companies and users, we need to account for the hasEquity filter, if passed.
         * In addition, we only push the value from filterVals if it is NOT a boolean, or
         * does not correspond to the hasEquity key in filterKeys array.
         * 
         * The idx needs to start at $1 for sql, so we add +1 to the forOf idx.
         */

        // JMT: we need the idx of the key to obtain the associate value regardless of what key
        const valIdx = filterKeys.indexOf(key);

        if (key === "titleLike") {
          // JMT: add our WHERE condition
          sqlWhereCondArr.push(`title ILIKE $${idx+1}`);
          // JMT: push the associated value to our filterValues array
          values.push(filterVals[valIdx])
        }
        if (key === "minSalary") {
          // JMT: add our WHERE condition
          sqlWhereCondArr.push(`salary>=$${idx+1}`);
           // JMT: push the associated value to our filterValues array
           values.push(filterVals[valIdx])
        }

        // JMT: if value of hasEquity is true then we ONLY NEED the WHERE condition, if not, no condition needed
        if (key === "hasEquity") {

          if (filterVals[valIdx]){
            // JMT: add our WHERE condition, if the hasEquity filter is true

            // JMT: need to fix this since equity is actually a string!
            sqlWhereCondArr.push(`equity>'0'`);
          }
        }
      }
      
      // JMT: update our WHERE condition string to include our conditions
      sqlWhereCondStr = "WHERE " + sqlWhereCondArr.join(" AND ")
    }

    /**
     * JMT:
     * 
     * sqlWhereCondStr: If no filters are passed to this , then that variable will be an
     * empty string and our query will not contain a WHERE parameter.
     * 
     * added: parameterized values.  added the [values] array to the end of our query
     * 
     * NOTE: tests need to be updated because now the return value will vary based on
     * what filters we pass to this findAll()function, if any.
     */

    // console.log("SQL WHERE condition: ".blue, sqlWhereCondStr)
    // console.log("Values for WHERE: ".blue, values)

    // JMT: seperated sqlQuery from db.query()
    const query = `
      SELECT id, title, salary, equity, company_handle
      FROM jobs
      ${sqlWhereCondStr}
      ORDER BY id`;

    const jobsRes = await db.query(query, values);
    return jobsRes.rows;
  }

  /** Given a job id, return data about job.
   *
   * Returns { id, title, salary, equity, company_handle }
   *
   * Throws NotFoundError if not found.
   **/

   static async get(id) {
    const jobRes = await db.query(
          `SELECT title, salary, equity, company_handle
           FROM jobs
           WHERE id = $1`, [id]);

    const job = jobRes.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);

    return job;
  }

  /** Update job data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: { title, salary, equity }
   *
   * Returns {id, title, salary, equity, company_handle}
   *
   * Throws NotFoundError if not found.
   */

  static async update(id, data) {
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
          title: "title",
          salary: "salary",
          equity: "equity",
        });
    /**
     * JMT: our parameterized idx will be +1 more than the number of values in our
     * db.query() values array because we are adding "id" to the values that
     * are submitted for update (see result variable below)
     */
    const idVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE jobs 
                      SET ${setCols} 
                      WHERE id = ${idVarIdx} 
                      RETURNING id, title, salary, equity, company_handle`;

    // JMT: we are destructuring our "values" array from the above call to sqlForPartialUpdate
    const result = await db.query(querySql, [...values, id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);

    return job;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   */

  static async remove(id) {
    const result = await db.query(
          `DELETE
           FROM jobs
           WHERE id = $1
           RETURNING id`,
        [id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);
  }
}


module.exports = Job;
