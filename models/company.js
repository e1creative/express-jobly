"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for companies. */

class Company {
  /** Create a company (from data), update db, return new company data.
   *
   * data should be { handle, name, description, numEmployees, logoUrl }
   *
   * Returns { handle, name, description, numEmployees, logoUrl }
   *
   * Throws BadRequestError if company already in database.
   * */

  static async create({ handle, name, description, numEmployees, logoUrl }) {
    const duplicateCheck = await db.query(
          `SELECT handle
           FROM companies
           WHERE handle = $1`,
        [handle]);

    if (duplicateCheck.rows[0])
      throw new BadRequestError(`Duplicate company: ${handle}`);

    const result = await db.query(
          `INSERT INTO companies
           (handle, name, description, num_employees, logo_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING handle, name, description, num_employees AS "numEmployees", logo_url AS "logoUrl"`,
        [
          handle,
          name,
          description,
          numEmployees,
          logoUrl,
        ],
    );
    const company = result.rows[0];

    return company;
  }

  /** Find all companies.
   *
   * Returns [{ handle, name, description, numEmployees, logoUrl }, ...]
   * */

  /**
   * JMT: added "filtersObj" parameter to findAll() which will be an object
   * 
   * filterObj will have been validated and checked in the route, so we can
   * focus on the actual filtering here in the model.
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
    let sqlNumEmployeesSelectArg = ""; // JMT: will be inserted into our query
    let filterKeys; // JMT: used if our filtersObj contains any items
    let filterVals; // JMT: used if our filtersObj contains any items

    // JMT: if our filtersObj has a "filters:" entry and the value of "filters:" contains items...
    if (Object.keys(filtersObj).length > 0 && Object.keys(filtersObj.filters).length > 0) {

      // JMT: update our initialized arrays with data from our passed "filters"
      filterKeys = Object.keys(filtersObj.filters);
      filterVals = Object.values(filtersObj.filters);

      // JMT: initialize an array where we can store our WHERE conditions (later we combine them into a string)
      const sqlWhereCondArr = [];
      /**
       * JMT: loop throug the keys from our filters object.
       * 1. find the index and key using .entries()
       * 2. create our string based on the current key value
       * 3. add our parameterized idx to correspond to the items in filterVals
       * 
       * NOTE: filterKeys and filterVals are already in the correct order.
       * i.e: filterKeys[0] matches filterVals[0] in our original req.body.
       * So we don't need to worry about order when using our parameterized 
       * values in our query.  (see comments below)
       */
      for (const [idx,key] of filterKeys.entries()){
        /**
         * JMT: the first iteration "key" will refer to the first "value" in our
         * filterValues array that we populated above.
         * 
         * We need the idx so we can properly create the parameterized string.
         * The idx needs to start at $1 for sql, so we add +1 to the forOf idx.
         */
        if (key === "nameLike") {
          sqlWhereCondArr.push(`name ILIKE $${idx+1}`);          
        }
        if (key === "minEmployees") {
          sqlWhereCondArr.push(`num_employees>=$${idx+1}`);
        }
        if (key === "maxEmployees") {
          sqlWhereCondArr.push(`num_employees<=$${idx+1}`);
        }
      }
      
      // JMT: update our WHERE condition string to include our conditions
      sqlWhereCondStr = "WHERE " + sqlWhereCondArr.join(" AND ")

      // JMT: if we are using minEmployeess or maxEmployees, update our SELECT arg
      if (filterKeys.includes("minEmployees") || filterKeys.includes("maxEmployees")) {
        sqlNumEmployeesSelectArg = `num_employees AS "numEmployees",`
      }
    }

    /**
     * JMT:
     * removed: ' num_employees AS "numEmployees", ' from db.query() and placed into a variable.
     * 
     * If we are not using minEmployees and maxEmployees searh filters, then the variable will be an empty string
     * IF we are using minEmployees and maxEmployees searh filters, then we can include the query.
     * 
     * The same goes for the sqlWhereCondStr.  If no filters are passed to this , then that variable will be an
     * empty string and our query will not contain a WHERE parameter.
     * 
     * added: parameterized values.  added the [values] array to the end of our query
     * 
     * NOTE: tests need to be updated because now the return value will vary based on
     * what filters we pass to this findAll()function, if any.
     */

    // console.log("SQL employees select param: ".blue, sqlNumEmployeesSelectArg)
    // console.log("SQL WHERE condition: ".blue, sqlWhereCondStr)
    // console.log("Values for WHERE: ".blue, filterVals)

    // JMT: seperated sqlQuery from db.query()
    const query = `
      SELECT handle,
        name,
        description,
        ${sqlNumEmployeesSelectArg}
        logo_url AS "logoUrl"
    FROM companies
    ${sqlWhereCondStr}
    ORDER BY name`;
    console.log("SQL query: ".blue, query)

    const companiesRes = await db.query(query, filterVals);
    return companiesRes.rows;
  }

  /** Given a company handle, return data about company.
   *
   * Returns { handle, name, description, numEmployees, logoUrl, jobs }
   *   where jobs is [{ id, title, salary, equity, companyHandle }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(handle) {
    const companyRes = await db.query(
          `SELECT handle,
                  name,
                  description,
                  num_employees AS "numEmployees",
                  logo_url AS "logoUrl"
           FROM companies
           WHERE handle = $1`,
        [handle]);

    const company = companyRes.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Update company data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {name, description, numEmployees, logoUrl}
   *
   * Returns {handle, name, description, numEmployees, logoUrl}
   *
   * Throws NotFoundError if not found.
   */

  static async update(handle, data) {
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
          numEmployees: "num_employees",
          logoUrl: "logo_url",
        });
    /**
     * JMT: our parameterized idx will be +1 more than the number of values in our
     * db.query() values array because we are adding "handle" to the values that
     * are submitted for update (see result variable below)
     */
    const handleVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE companies 
                      SET ${setCols} 
                      WHERE handle = ${handleVarIdx} 
                      RETURNING handle, 
                                name, 
                                description, 
                                num_employees AS "numEmployees", 
                                logo_url AS "logoUrl"`;
    // JMT: we are destructuring our "values" array from the above call to sqlForPartialUpdate
    const result = await db.query(querySql, [...values, handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(handle) {
    const result = await db.query(
          `DELETE
           FROM companies
           WHERE handle = $1
           RETURNING handle`,
        [handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);
  }
}


module.exports = Company;
