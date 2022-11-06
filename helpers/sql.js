const { BadRequestError } = require("../expressError");

// THIS NEEDS SOME GREAT DOCUMENTATION.
/**
 * JMT:
 * 
 * The sqlForPartialUpdate() function is used to partially update database entries.
 * 
 * The function is exported and then imported in the User and Company models.
 * 
 * The function is called when a user submits data to the following routes:
 *    - PATCH /users/:username
 *    - PATCH /companies/:handle
 * 
 * NOTE: The UPDATE schemas (/schemas/[user/company]Update.json) DO NOT require all fields to be present.
 * 
 * NOTE: For users Data can include: { firstName, lastName, password, email } (but does not require all fields)
 * NOTE: For companies Data can include: {name, description, numEmployees, logoUrl} (but does not require all fields)
 * 
 * ARGS:
 * dataToUpdate: JSON from the req.body
 * jsToSql:      an object that contains { the_JSON_key: the_SQL_col_name } 
 *               (this is hardcoded in the model and passed to this function)
 *               User: { firstName: "first_name", lastName: "last_name", isAdmin: "is_admin", }
 *               Company: { numEmployees: "num_employees", logoUrl: "logo_url",}
 *               
 *               IMPORTANT: WE do this because the JSON key name is NOT the same 
 *               as the SQL col name for these 3 items.  For "email" and "password"
 *               we don't need to translate the JSON key name to the SQL col name.
 */

function sqlForPartialUpdate(dataToUpdate, jsToSql) {
  /**
   * JMT: get the keys from the req.body (dataToUpdate) and check if data exists.  
   * If so, we place the keys from the req.body object into an array called "keys".
   */
  const keys = Object.keys(dataToUpdate);
  // JMT: if no data exists, throw a BadRequestError
  if (keys.length === 0) throw new BadRequestError("No data");
  /**
   * JMT: if data exists, map the values from "keys" to a new array called "cols"
   * 
   * The map function adds EITHER the SQL col name (found using the jsToSql obj)
   * or the col name to the new "cols" array, followed by a "=$" and the idx of
   * the current item + 1. 
   * 
   * i.e. if "email" is found in the data, map will add jsToSql[email] OR "email"
   * to the "cols array.  In the case of "email": jsToSql[email] doesn't exist, so
   * "email" will be added.
   * 
   * The "cols" array will contain an array of strings that look like: "first_name"=$1
   * We'll join each value with a ", " in our return statement below
   */

  // {firstName: 'Aliya', age: 32} => ['"first_name"=$1', '"age"=$2']
  const cols = keys.map((colName, idx) =>
      `"${jsToSql[colName] || colName}"=$${idx + 1}`,
  );
  /**
   * JMT: return an object
   * 
   * key = "setCols"
   * value = a string of SQL col names with parameterized values (will be used in db.query() in our models)
   * 
   * AND
   * 
   * key = "values"
   * value = an array containing the values from the req.body (dataToUpdate)
   */
  return {
    setCols: cols.join(", "),
    values: Object.values(dataToUpdate),
  };
}

module.exports = { sqlForPartialUpdate };
