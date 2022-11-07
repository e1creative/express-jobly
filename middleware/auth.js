"use strict";

/** Convenience middleware to handle common auth cases in routes. */

const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config");
const { UnauthorizedError } = require("../expressError");


/** Middleware: Authenticate user.
 *
 * If a token was provided, verify it, and, if valid, store the token payload
 * on res.locals (this will include the username and isAdmin field.)
 *
 * It's not an error if no token was provided or if the token is not valid.
 */

function authenticateJWT(req, res, next) {
  try {
    // console.log(req.params)
    // JMT: need to send key "authorization" with value of our token in the request header
    const authHeader = req.headers && req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace(/^[Bb]earer /, "").trim();
      res.locals.user = jwt.verify(token, SECRET_KEY);
    }
    /**
     * JMT: res.locals is our user info that will contain { username, isAdmin, iat }
     * 
     * if res.locals.user doesn't exist, then we have not been authorized
     */
    // console.log("res.locals.user: ".blue, res.locals.user)
    return next();
  } catch (err) {
    return next();
  }
}

/** Middleware to use when they must be logged in.
 *
 * If not, raises Unauthorized.
 */

function ensureLoggedIn(req, res, next) {
  try {
    if (!res.locals.user) throw new UnauthorizedError();
    return next();
  } catch (err) {
    return next(err);
  }
}

/** JMT: Middleware to use when they must be logged in and an admin
 * 
 * If not, raises Unauthorized
 */

 function ensureIsAdmin(req, res, next) {
  try {
    if (!res.locals.user) throw new UnauthorizedError();
    if (!res.locals.user.isAdmin === true) throw new UnauthorizedError();
    return next();
  } catch (err) {
    return next(err);
  }
}

/** JMT: Middleware to use when they must be logged in as the correct user OR as an admin
 * 
 * If not, raises Unauthorized
 * 
 * Used on User routes only, so far
 */

 function ensureCorrectUser(req, res, next) {
  try {
    if (!res.locals.user) throw new UnauthorizedError();
    if (! (res.locals.user.username === req.params.username || res.locals.user.isAdmin === true) ) throw new UnauthorizedError()
    return next();
  } catch (err) {
    return next(err);
  }
}


module.exports = {
  authenticateJWT,
  ensureLoggedIn,
  ensureIsAdmin,
  ensureCorrectUser
};
