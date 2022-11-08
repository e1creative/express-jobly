"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const Job = require("./job.js");
const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** create */

describe("create", function () {
  const newJob = {
    title: "job",
    salary: 100000,
    equity: 0,
    company_handle: "c1"
  };

  test("works", async function () {
    let job = await Job.create(newJob);
    expect(job).toEqual({
      id: expect.any(Number),
      title: "job",
      salary: 100000,
      equity: "0", // JMT: equity (NUMERIC type) returns a string
      company_handle: "c1"
    });

    const result = await db.query(
          `SELECT id, title, salary, equity, company_handle
           FROM jobs
           WHERE title = 'job'`);
    expect(result.rows).toEqual([
      {
        id: expect.any(Number),
        title: "job",
        salary: 100000,
        equity: "0", // JMT: equity (NUMERIC type) returns a string
        company_handle: "c1",
      },
    ]);
  });

  /**
   * JMT: commented out because we can't actually have dupes since each job is given a new id AUTO
   * and the SQL schema doesn't have any declared UNIQUE keys, so we could actually have the same
   * job description for the same company, UNLES WE CHANGE THE SCHEMA
   */
//   test("bad request with dupe", async function () {
//     try {
//       await Job.create(newJob);
//       await Job.create(newJob);
//       fail();
//     } catch (err) {
//       expect(err instanceof BadRequestError).toBeTruthy();
//     }
//   });
});

/************************************** findAll */

describe("findAll", function () {
  // JMT: adjusted test to account for data being passed in to the function
  test("works: no filter", async function () {
    let jobs = await Job.findAll({});
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "job1",
        salary: 55000,
        equity: "0",
        company_handle: "c1",
      },
      {
        id: expect.any(Number),
        title: "job2",
        salary: 65000,
        equity: "0",
        company_handle: "c2",
      },
      {
        id: expect.any(Number),
        title: "job3",
        salary: 75000,
        equity: "0",
        company_handle: "c3",
      },
    ]);
  });
  // JMT: add testing for filtering ability
  test("works: titleLike filter", async function () {
    const filter = { filters: { titleLike: "%job%"}}
    let jobs = await Job.findAll(filter)
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "job1",
        salary: 55000,
        equity: "0",
        company_handle: "c1",
      },
      {
        id: expect.any(Number),
        title: "job2",
        salary: 65000,
        equity: "0",
        company_handle: "c2",
      },
      {
        id: expect.any(Number),
        title: "job3",
        salary: 75000,
        equity: "0",
        company_handle: "c3",
      },
    ]);
  });

  test("works: minSalary filter", async function () {
    const filter = { filters: { minSalary: 65000}}
    let jobs = await Job.findAll(filter)
    expect(jobs).toEqual([
      {
        id: expect.any(Number),
        title: "job2",
        salary: 65000,
        equity: "0",
        company_handle: "c2",
      },
      {
        id: expect.any(Number),
        title: "job3",
        salary: 75000,
        equity: "0",
        company_handle: "c3",
      },
    ]);
  });

  test("works: hasEquity filter", async function () {
    const filter = { filters: { hasEquity: true } }
    let jobs = await Job.findAll(filter)
    expect(jobs).toEqual([]);
  });
});

/************************************** get */

describe("get", function () {
  test("works", async function () {
    const job1 = await db.query(`
      SELECT id, title, salary, equity, company_handle
      FROM jobs
      WHERE title='job1'`);
    const testID = job1.rows[0].id;

    let job = await Job.get(testID);
    expect(job).toEqual({
      title: "job1",
      salary: 55000,
      equity: "0",
      company_handle: "c1",
    });
  });

  test("not found if no such company", async function () {
    try {
      await Job.get(0);
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
});

/************************************** update */

// describe("update", function () {
//   const updateData = {
//     name: "New",
//     description: "New Description",
//     numEmployees: 10,
//     logoUrl: "http://new.img",
//   };

//   test("works", async function () {
//     let company = await Company.update("c1", updateData);
//     expect(company).toEqual({
//       handle: "c1",
//       ...updateData,
//     });

//     const result = await db.query(
//           `SELECT handle, name, description, num_employees, logo_url
//            FROM companies
//            WHERE handle = 'c1'`);
//     expect(result.rows).toEqual([{
//       handle: "c1",
//       name: "New",
//       description: "New Description",
//       num_employees: 10,
//       logo_url: "http://new.img",
//     }]);
//   });

//   test("works: null fields", async function () {
//     const updateDataSetNulls = {
//       name: "New",
//       description: "New Description",
//       numEmployees: null,
//       logoUrl: null,
//     };

//     let company = await Company.update("c1", updateDataSetNulls);
//     expect(company).toEqual({
//       handle: "c1",
//       ...updateDataSetNulls,
//     });

//     const result = await db.query(
//           `SELECT handle, name, description, num_employees, logo_url
//            FROM companies
//            WHERE handle = 'c1'`);
//     expect(result.rows).toEqual([{
//       handle: "c1",
//       name: "New",
//       description: "New Description",
//       num_employees: null,
//       logo_url: null,
//     }]);
//   });

//   test("not found if no such company", async function () {
//     try {
//       await Company.update("nope", updateData);
//       fail();
//     } catch (err) {
//       expect(err instanceof NotFoundError).toBeTruthy();
//     }
//   });

//   test("bad request with no data", async function () {
//     try {
//       await Company.update("c1", {});
//       fail();
//     } catch (err) {
//       expect(err instanceof BadRequestError).toBeTruthy();
//     }
//   });
// });

/************************************** remove */

describe("remove", function () {
  test("works", async function () {
    const job1 = await db.query(`
      SELECT *
      FROM jobs
      WHERE title='job1'`);
    const testID = job1.rows[0].id;

    await Job.remove(testID);
    const res = await db.query(
        `SELECT * FROM jobs WHERE id=${testID}`);
    expect(res.rows.length).toEqual(0);
  });

  test("not found if no such company", async function () {
    try {
      await Job.remove("0");
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
});