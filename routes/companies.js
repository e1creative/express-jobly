"use strict";

/** Routes for companies. */

const jsonschema = require("jsonschema");
const express = require("express");

const { BadRequestError } = require("../expressError");
const { ensureIsAdmin } = require("../middleware/auth");
const Company = require("../models/company");

const companyNewSchema = require("../schemas/companyNew.json");
const companyUpdateSchema = require("../schemas/companyUpdate.json");

// JMT: adding filter schema (fields not required)
const companyFilterSchema = require("../schemas/companyFilter.json");

const router = new express.Router();


/** POST / { company } =>  { company }
 *
 * company should be { handle, name, description, numEmployees, logoUrl }
 *
 * Returns { handle, name, description, numEmployees, logoUrl }
 *
 * Authorization required: login
 */

// JMT: added ensureIsAdmin middleware
router.post("/", ensureIsAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, companyNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const company = await Company.create(req.body);
    return res.status(201).json({ company });
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
 * { filters: [minEmployees, maxEmployees, name ] }
 * 
 * Filters:
 * 
 * name: filter by company name
 * i.e. if the string “net” is passed in, this should find any company
 * whose name contains the word “net”, case-insensitive (so “Study Networks” should be included).
 * 
 * minEmployees: filter to companies that have at least that number of employees.
 * 
 * maxEmployees: filter to companies that have no more than that number of employees.
 * 
 * If the minEmployees parameter is greater than the maxEmployees parameter, 
 * respond with a 400 error with an appropriate message.
 */

router.get("/", async function (req, res, next) {
  try {
    /** 
     * JMT: validation for our req.body fields before passing it to our model
     * 
     * Added: companyFilterSchema in /schemas/companyFilter.json
     * 
     * Added: filter parameter to findAll()
     */
    const validator = jsonschema.validate(req.body, companyFilterSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    // JMT: if filters exists...
    if (req.body.filters){
      // JMT: check that minEmployees >= 0 and maxEmployees >= 0...
      if (req.body.filters.minEmployees >= 0 && req.body.filters.maxEmployees >= 0) {
        const { minEmployees, maxEmployees } = req.body.filters;
        // JMT: make sure maxEmployees is greater than minEmployees
        if (maxEmployees <= minEmployees) {
          const errs = ["Max employees must be greater than the min employees"];
          throw new BadRequestError(errs);
        }
      }
      // JMT: if "nameLike" filter exists, create the proper query, adding % to the beginning and end
      if (req.body.filters.nameLike) {
        req.body.filters.nameLike = "%" + req.body.filters.nameLike + "%"
      }
    }   

    const companies = await Company.findAll(req.body);
    return res.json({ companies });
  } catch (err) {
    return next(err);
  }
});

/** GET /[handle]  =>  { company }
 *
 *  Company is { handle, name, description, numEmployees, logoUrl, jobs }
 *   where jobs is [{ id, title, salary, equity }, ...]
 *
 * Authorization required: none
 */

router.get("/:handle", async function (req, res, next) {
  try {
    const company = await Company.get(req.params.handle);
    return res.json({ company });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /[handle] { fld1, fld2, ... } => { company }
 *
 * Patches company data.
 *
 * fields can be: { name, description, numEmployees, logo_url }
 *
 * Returns { handle, name, description, numEmployees, logo_url }
 *
 * Authorization required: login
 */

// JMT: added ensureIsAdmin middleware
router.patch("/:handle", ensureIsAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, companyUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const company = await Company.update(req.params.handle, req.body);
    return res.json({ company });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /[handle]  =>  { deleted: handle }
 *
 * Authorization: login
 */

// JMT: added ensureIsAdmin middleware
router.delete("/:handle", ensureIsAdmin, async function (req, res, next) {
  try {
    await Company.remove(req.params.handle);
    return res.json({ deleted: req.params.handle });
  } catch (err) {
    return next(err);
  }
});


module.exports = router;
