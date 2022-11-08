"use strict";

/** Routes for jobs. */

const jsonschema = require("jsonschema");
const express = require("express");

const { BadRequestError } = require("../expressError");
const { ensureIsAdmin } = require("../middleware/auth");
const Job = require("../models/job");

const jobNewSchema = require("../schemas/jobNew.json");
const jobUpdateSchema = require("../schemas/jobUpdate.json");

// JMT: adding filter schema (fields not required)
const jobFilterSchema = require("../schemas/jobFilter.json");

const router = new express.Router();


/** POST / { job } =>  { job }
 *
 * job should be { title, salary, equity, company_handle }
 *
 * Returns { id, title, salary, equity, company_handle }
 *
 * Authorization required: login
 */

// JMT: added ensureIsAdmin middleware
router.post("/", ensureIsAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, jobNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const job = await Job.create(req.body);
    return res.status(201).json({ job });
  } catch (err) {
    return next(err);
  }
});

/** GET /  =>
 *   { companies: [ { handle, name, description, numEmployees, logoUrl }, ...] }
 *
 * Can filter on provided search filters:
 * - minEmployees
 * - maxEmployees
 * - nameLike (will find case-insensitive, partial matches)
 *
 * Authorization required: none
 */

/**
 * JMT : can provide optional search filters in the body.
 * 
 * { filters: [titleLike, minSalary, hasEquity ] }
 * 
 * Filters:
 * 
 * titleLike: filter by job name
 * i.e. if the string “net” is passed in, this should find any company
 * whose name contains the word “net”, case-insensitive (so “Study Networks” should be included).
 * 
 * minSalary: filter to jobs with at least that salary.
 * 
 * hasEquity: if true, filter to jobs that provide a non-zero amount of equity. 
 * If false or not included in the filtering, list all jobs regardless of equity.
 */

router.get("/", async function (req, res, next) {
  try {
    /** 
     * JMT: validation for our req.body fields before passing it to our model
     * 
     * Added: jobilterSchema in /schemas/jobFilter.json
     * 
     * Added: filter parameter to findAll()
     */
    const validator = jsonschema.validate(req.body, jobFilterSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    // JMT: if filters exists...
    if (req.body.filters){
      // JMT: if "titleLike" filter exists, create the proper query, adding % to the beginning and end
      if (req.body.filters.titleLike) {
        req.body.filters.titleLike = "%" + req.body.filters.titleLike + "%"
      }
    }   

    const jobs = await Job.findAll(req.body);
    return res.json({ jobs });
  } catch (err) {
    return next(err);
  }
});

/** GET /[id]  =>  { job }
 *
 *  Job is { id, title, salary, equity, company_handle }
 *
 * Authorization required: none
 */

router.get("/:id", async function (req, res, next) {
  try {
    const job = await Job.get(req.params.id);
    return res.json({ job });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /[id] { fld1, fld2, ... } => { company }
 *
 * Patches job data.
 *
 * fields can be: { title, salary, equity }
 *
 * Returns { id, title, salary, equity, company_handle }
 *
 * Authorization required: login
 */

// JMT: added ensureIsAdmin middleware
router.patch("/:id", ensureIsAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, jobUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const job = await Job.update(req.params.id, req.body);
    return res.json({ job });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /[handle]  =>  { deleted: handle }
 *
 * Authorization: login
 */

// JMT: added ensureIsAdmin middleware
router.delete("/:id", ensureIsAdmin, async function (req, res, next) {
  try {
    await Job.remove(req.params.id);
    return res.json({ deleted: req.params.id });
  } catch (err) {
    return next(err);
  }
});


module.exports = router;