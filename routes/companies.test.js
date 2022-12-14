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

/************************************** POST /companies */

// JMT: modify to work with ensureIsAdmin middleware. changed all users to ADMIN user (u3Token)

describe("POST /companies", function () {
  const newCompany = {
    handle: "new",
    name: "New",
    logoUrl: "http://new.img",
    description: "DescNew",
    numEmployees: 10,
  };
  // JMT: u3 is an admin
  test("ok for admins", async function () {
    const resp = await request(app)
        .post("/companies")
        .send(newCompany)
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(201);
    expect(resp.body).toEqual({
      company: newCompany,
    });
  });

  test("NOT ok for NON-admin users", async function () {
    const resp = await request(app)
        .post("/companies")
        .send(newCompany)
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(401);
  });

  // test("ok for users", async function () {
  //   const resp = await request(app)
  //       .post("/companies")
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
        .post("/companies")
        .send({
          handle: "new",
          numEmployees: 10,
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  // JMT: change authorization to an admin (u3Token)
  test("bad request with invalid data", async function () {
    const resp = await request(app)
        .post("/companies")
        .send({
          ...newCompany,
          logoUrl: "not-a-url",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** GET /companies */

// JMT: modify to work with filters

describe("GET /companies", function () {
  // JMT: added testing for validation of data before sending req.body to our model
  test("validator throws error with incorrect data", async function () {
    // JMT: 3 int should be a string
    const data1 = { filters: { nameLike: 3} }
    const result1 = await request(app).get("/companies").send(data1)
    expect(result1.statusCode).toEqual(400)
    // JMT: wrong key, should be nameLike
    const data2 = { filters: { name: "3"} }
    const result2 = await request(app).get("/companies").send(data2)
    expect(result2.statusCode).toEqual(400)
    // JMT: minEmployees val should be an INT
    const data3 = { filters: { nameLike: "net", minEmployees: "2" } }
    const result3 = await request(app).get("/companies").send(data3)
    expect(result3.statusCode).toEqual(400)
    // JMT: filter key should be "filters" w/ an "s"
    const data4 = { filter: { nameLike: "net", minEmployees: "2" } }
    const result4 = await request(app).get("/companies").send(data4)
    expect(result4.statusCode).toEqual(400)
  });

  /**
   * JMT: changed testing for "ok for anon" test to account for removal of the
   * numEmployees line if no filtering is passed to the route
   */
  test("ok for anon with no filter data", async function () {
    const resp = await request(app).get("/companies");
    expect(resp.body).toEqual({
      companies:
          [
            {
              handle: "c1",
              name: "C1",
              description: "Desc1",
              logoUrl: "http://c1.img",
            },
            {
              handle: "c2",
              name: "C2",
              description: "Desc2",
              logoUrl: "http://c2.img",
            },
            {
              handle: "c3",
              name: "C3",
              description: "Desc3",
              logoUrl: "http://c3.img",
            },
          ],
    });
  });

  // JMT: below is the original test
  // test("ok for anon", async function () {
  //   const resp = await request(app).get("/companies");
  //   expect(resp.body).toEqual({
  //     companies:
  //         [
  //           {
  //             handle: "c1",
  //             name: "C1",
  //             description: "Desc1",
  //             numEmployees: 1,
  //             logoUrl: "http://c1.img",
  //           },
  //           {
  //             handle: "c2",
  //             name: "C2",
  //             description: "Desc2",
  //             numEmployees: 2,
  //             logoUrl: "http://c2.img",
  //           },
  //           {
  //             handle: "c3",
  //             name: "C3",
  //             description: "Desc3",
  //             numEmployees: 3,
  //             logoUrl: "http://c3.img",
  //           },
  //         ],
  //   });
  // });

  test("fails: test next() handler", async function () {
    // there's no normal failure event which will cause this route to fail ---
    // thus making it hard to test that the error-handler works with it. This
    // should cause an error, all right :)
    await db.query("DROP TABLE companies CASCADE");
    const resp = await request(app)
        .get("/companies")
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(500);
  });
});

/************************************** GET /companies/:handle */

describe("GET /companies/:handle", function () {
  test("works for anon", async function () {
    const resp = await request(app).get(`/companies/c1`);
    expect(resp.body).toEqual({
      company: {
        handle: "c1",
        name: "C1",
        description: "Desc1",
        numEmployees: 1,
        logoUrl: "http://c1.img",
        jobs: [{ id: expect.any(Number), title: "job1", salary: 55000, equity: "0" }]
      },
    });
  });

  test("works for anon: company w/o jobs", async function () {
    const resp = await request(app).get(`/companies/c2`);
    expect(resp.body).toEqual({
      company: {
        handle: "c2",
        name: "C2",
        description: "Desc2",
        numEmployees: 2,
        logoUrl: "http://c2.img",
        jobs: expect.any(Array)
      },
    });
  });

  test("not found for no such company", async function () {
    const resp = await request(app).get(`/companies/nope`);
    expect(resp.statusCode).toEqual(404);
  });
});

/************************************** PATCH /companies/:handle */

// JMT: modify to work with ensureIsAdmin middleware. changed all users to ADMIN user (u3Token)

describe("PATCH /companies/:handle", function () {
  test("works for ADMIN users", async function () {
    const resp = await request(app)
        .patch(`/companies/c1`)
        .send({
          name: "C1-new",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.body).toEqual({
      company: {
        handle: "c1",
        name: "C1-new",
        description: "Desc1",
        numEmployees: 1,
        logoUrl: "http://c1.img",
      },
    });
  });

  // JMT: add check for NON-ADMIN logged in user with u1Token (non-admin)
  test("unauth for anon", async function () {
    const resp = await request(app)
        .patch(`/companies/c1`)
        .send({
          name: "C1-new",
        })
        .set("authorization", `Bearer ${u1Token}`);;
    expect(resp.statusCode).toEqual(401);
  });
  // JMT: end

  test("unauth for anon", async function () {
    const resp = await request(app)
        .patch(`/companies/c1`)
        .send({
          name: "C1-new",
        });
    expect(resp.statusCode).toEqual(401);
  });

  test("not found on no such company", async function () {
    const resp = await request(app)
        .patch(`/companies/nope`)
        .send({
          name: "new nope",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(404);
  });

  test("bad request on handle change attempt", async function () {
    const resp = await request(app)
        .patch(`/companies/c1`)
        .send({
          handle: "c1-new",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request on invalid data", async function () {
    const resp = await request(app)
        .patch(`/companies/c1`)
        .send({
          logoUrl: "not-a-url",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** DELETE /companies/:handle */

// JMT: modify to work with ensureIsAdmin middleware

describe("DELETE /companies/:handle", function () {
  test("works for ADMIN users", async function () {
    const resp = await request(app)
        .delete(`/companies/c1`)
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.body).toEqual({ deleted: "c1" });
  });

  // JMT: add check for NON-ADMIN logged in user with u1Token (non-admin)
  test("unauth for NON-ADMIN logged in user", async function () {
    const resp = await request(app)
        .delete(`/companies/c1`)
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(401);
  });
  // JMT: end

  test("unauth for anon", async function () {
    const resp = await request(app)
        .delete(`/companies/c1`);
    expect(resp.statusCode).toEqual(401);
  });

  test("not found for no such company", async function () {
    const resp = await request(app)
        .delete(`/companies/nope`)
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(404);
  });
});
