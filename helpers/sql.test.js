"use strict";

/** Test for sql.js (100% written by JMT) */

const { BadRequestError } = require('../expressError');
const { sqlForPartialUpdate } = require('./sql')

describe("test sqlForPartialUpdate function", function () {
  test("returns an error if no data is passed", function() {
    const dataToUpdate = {}
    const jsToSql = { firstName: "first_name", lastName: "last_name", isAdmin: "is_admin",
    }
    expect(() => sqlForPartialUpdate(dataToUpdate, jsToSql)).toThrow(BadRequestError)
    expect(() => sqlForPartialUpdate(dataToUpdate, jsToSql)).toThrow("No data")
  });

  test("returns an object", function() {
    const dataToUpdate = { firstName: "testFN1", lastName: "testLN1", password: "testPassword", email: "test@test.com" }
    const jsToSql = { firstName: "first_name", lastName: "last_name", isAdmin: "is_admin",
    }

    const result = sqlForPartialUpdate(dataToUpdate, jsToSql)

    expect(result).toEqual(expect.any(Object))
  });

  test("returned object[setCols] contains a string", function() {
    const dataToUpdate = { firstName: "testFN1", lastName: "testLN1", password: "testPassword", email: "test@test.com" }
    const jsToSql = { firstName: "first_name", lastName: "last_name", isAdmin: "is_admin",
    }

    const result = sqlForPartialUpdate(dataToUpdate, jsToSql)

    expect(result.setCols).toEqual(expect.any(String))
  });

  test("returned object[values] contains an array", function() {
    const dataToUpdate = { firstName: "testFN1", lastName: "testLN1", password: "testPassword", email: "test@test.com" }
    const jsToSql = { firstName: "first_name", lastName: "last_name", isAdmin: "is_admin",
    }
    const result = sqlForPartialUpdate(dataToUpdate, jsToSql)

    expect(result.values).toEqual(expect.any(Array))
  });

  test("returned object[setCols] string contains parameterized items", function() {
    const dataToUpdate = { firstName: "testFN1", lastName: "testLN1", password: "testPassword", email: "test@test.com" }
    const jsToSql = { firstName: "first_name", lastName: "last_name", isAdmin: "is_admin",
    }
    const result = sqlForPartialUpdate(dataToUpdate, jsToSql)

    expect(result.setCols).toContain('"first_name"=$1')
    expect(result.setCols).toContain('"last_name"=$2')
    expect(result.setCols).toContain('"password"=$3')
    expect(result.setCols).toContain('"email"=$4')
    expect(result.setCols).toEqual('"first_name"=$1, "last_name"=$2, "password"=$3, "email"=$4')
  });

  test("returned object[values] array contains proper values", function() {
    const dataToUpdate = { firstName: "testFN1", lastName: "testLN1", password: "testPassword", email: "test@test.com" }
    const jsToSql = { firstName: "first_name", lastName: "last_name", isAdmin: "is_admin",
    }
    const result = sqlForPartialUpdate(dataToUpdate, jsToSql)

    expect(result.values).toContain("testFN1")
    expect(result.values).toContain("testLN1")
    expect(result.values).toContain("testPassword")
    expect(result.values).toContain("test@test.com")
  });
})