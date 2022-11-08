"use strict";

const request = require("supertest");

const db = require("../db");
const app = require("../app");

const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
  u1Token,
  u3Token // JMT: add u3Token (isAdmin: true)
} = require("./_testCommon");
const { BadRequestError } = require("../expressError");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** POST /jobs */

// JMT: modify to work with ensureIsAdmin middleware. changed all users to ADMIN user (u3Token)

describe("POST /jobs", function () {
  const newJob = {
    title: "testJob",
    salary: 100000,
    equity: 0,
    company_handle: "c1",
  };
  // JMT: u3 is an admin
  test("ok for admins", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send(newJob)
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(201);
    console.log(resp.body)
    expect(resp.body).toEqual({
      job: { 
        id: expect.any(Number),
        title: "testJob",
        salary: 100000,
        equity: "0",
        company_handle: "c1",
      },
    });
  });

  test("NOT ok for NON-admin users", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send(newJob)
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(401);
  });

  // test("ok for users", async function () {
  //   const resp = await request(app)
  //       .post("/jobs")
  //       .send(newCompany)
  //       .set("authorization", `Bearer ${u1Token}`);
  //   expect(resp.statusCode).toEqual(201);
  //   expect(resp.body).toEqual({
  //     company: newCompany,
  //   });
  // });

  // JMT: change authorization to an admin (u3Token)
  test("bad request with missing data", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send({
          title: "new",
          salary: 100000
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  // JMT: change authorization to an admin (u3Token)
  test("bad request with invalid data", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send({
          ...newJob,
          notAllowed: "not-allowed",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** GET /jobs */

// JMT: modify to work with filters

describe("GET /jobs", function () {
  // JMT: added testing for validation of data before sending req.body to our model
  test("validator throws error with incorrect data", async function () {
    // JMT: 3 int should be a string
    const data1 = { filters: { titleLike: 3} }
    const result1 = await request(app).get("/jobs").send(data1)
    expect(result1.statusCode).toEqual(400)
    // JMT: wrong key, should be titleLike
    const data2 = { filters: { title: "3"} }
    const result2 = await request(app).get("/jobs").send(data2)
    expect(result2.statusCode).toEqual(400)
    // JMT: minSalary val should be an number
    const data3 = { filters: { titleLike: "job", minSalary: "65000" } }
    const result3 = await request(app).get("/jobs").send(data3)
    expect(result3.statusCode).toEqual(400)
    // JMT: filter key should be "filters" w/ an "s"
    const data4 = { filter: { nameLike: "net", minSalary: 65000 } }
    const result4 = await request(app).get("/jobs").send(data4)
    expect(result4.statusCode).toEqual(400)
  });

  /**
   * JMT: changed testing for "ok for anon" test to account for removal of the
   * numEmployees line if no filtering is passed to the route
   */
  test("ok for anon with no filter data", async function () {
    const resp = await request(app).get("/jobs");
    expect(resp.body).toEqual({
      jobs:
          [
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
          ],
    });
  });

  // JMT: below is the original test
  // test("ok for anon", async function () {
  //   const resp = await request(app).get("/jobs");
  //   expect(resp.body).toEqual({
  //     jobs:
  //         [
  //           {
  //             title: "c1",
  //             salary "C1",
  //             description: "Desc1",
  //             numEmployees: 1,
  //             logoUrl: "http://c1.img",
  //           },
  //           {
  //             title: "c2",
  //             salary "C2",
  //             description: "Desc2",
  //             numEmployees: 2,
  //             logoUrl: "http://c2.img",
  //           },
  //           {
  //             title: "c3",
  //             salary "C3",
  //             description: "Desc3",
  //             numEmployees: 3,
  //             logoUrl: "http://c3.img",
  //           },
  //         ],
  //   });
  // });

  test("fails: test next() titler", async function () {
    // there's no normal failure event which will cause this route to fail ---
    // thus making it hard to test that the error-titler works with it. This
    // should cause an error, all right :)
    await db.query("DROP TABLE jobs CASCADE");
    const resp = await request(app)
        .get("/jobs")
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(500);
  });
});

/************************************** GET /jobs/:title */

describe("GET /jobs/:id", function () {
  test("works for anon", async function () {
    const testJob = await db.query(`SELECT * FROM jobs WHERE title='job1'`);
    const testJobID = testJob.rows[0].id;

    const resp = await request(app).get(`/jobs/${testJobID}`);
    expect(resp.body).toEqual({
      job: {
        title: "job1",
        salary: 55000,
        equity: "0",
        company_handle: "c1"
      },
    });
  });

  test("not found for no such job", async function () {
    const resp = await request(app).get(`/jobs/0`);
    expect(resp.statusCode).toEqual(404);
  });
});


/************************************** PATCH /jobs/:title */

// JMT: modify to work with ensureIsAdmin middleware. changed all users to ADMIN user (u3Token)

describe("PATCH /jobs/:id", function () {
  test("works for ADMIN users", async function () {
    const testJob = await db.query(`SELECT * FROM jobs WHERE title='job1'`);
    const testJobID = testJob.rows[0].id;

    const resp = await request(app)
        .patch(`/jobs/${testJobID}`)
        .send({
          salary: 100000,
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.body).toEqual({
      job: {
        id: testJobID,
        title: "job1",
        salary: 100000,
        equity: "0",
        company_handle: "c1",
      },
    });
  });

  // JMT: add check for NON-ADMIN logged in user with u1Token (non-admin)
  test("unauth for NON-ADMIN logged in user", async function () {
    const testJob = await db.query(`SELECT * FROM jobs WHERE title='job1'`);
    const testJobID = testJob.rows[0].id;

    const resp = await request(app)
        .patch(`/jobs/${testJobID}`)
        .send({
          salary: 100000,
        })
        .set("authorization", `Bearer ${u1Token}`);;
    expect(resp.statusCode).toEqual(401);
  });
  // JMT: end

  test("unauth for anon", async function () {
    const testJob = await db.query(`SELECT * FROM jobs WHERE title='job1'`);
    const testJobID = testJob.rows[0].id;

    const resp = await request(app)
        .patch(`/jobs/${testJobID}`)
        .send({
          salary: 100000,
        });
    expect(resp.statusCode).toEqual(401);
  });

  test("not found on no such job", async function () {
    const resp = await request(app)
        .patch(`/jobs/0`)
        .send({
          title: "job1Update",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(404);
  });

  test("bad request on company_handle change attempt", async function () {
    const testJob = await db.query(`SELECT * FROM jobs WHERE title='job1'`);
    const testJobID = testJob.rows[0].id;

    const resp = await request(app)
        .patch(`/jobs/${testJobID}`)
        .send({
          company_handle: "c1-new",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request on invalid data", async function () {
    const testJob = await db.query(`SELECT * FROM jobs WHERE title='job1'`);
    const testJobID = testJob.rows[0].id;

    const resp = await request(app)
        .patch(`/jobs/${testJobID}`)
        .send({
          salary: "100000",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** DELETE /jobs/:title */

// JMT: modify to work with ensureIsAdmin middleware

describe("DELETE /jobs/:id", function () {
  test("works for ADMIN users", async function () {
    const testJob = await db.query(`SELECT * FROM jobs WHERE title='job1'`);
    const testJobID = testJob.rows[0].id;

    const resp = await request(app)
        .delete(`/jobs/${testJobID}`)
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.body).toEqual({ deleted: `${testJobID}` });
  });

  // JMT: add check for NON-ADMIN logged in user with u1Token (non-admin)
  test("unauth for NON-ADMIN logged in user", async function () {
    const resp = await request(app)
        .delete(`/jobs/1`)
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(401);
  });
  // JMT: end

  test("unauth for anon", async function () {
    const resp = await request(app)
        .delete(`/jobs/1`);
    expect(resp.statusCode).toEqual(401);
  });

  test("not found for no such job", async function () {
    const resp = await request(app)
        .delete(`/jobs/0`)
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(404);
  });
});