/**
 * Express router providing index related routes
 * @module routes/index
 * @author Alexandre Dewilde
 * @date 15/11/2020
 * @version 1.0.0
 * @requires express
 * @requires ../db/MangoDB
 *
 */

  /**
 * express module
 * @const
 */
const express = require('express');
 /**
 * MangoDB module
 * @const
 * @type {object}
 */
const db = require('../db/MongoDB');
const config = require('../config/config');
/**
 * Express router.
 * @type {object}
 * @const
 */
const router = express.Router();

/**
 * Route serving editorindex page
 * @name get/
 * @function
 * @memberof modules:routes/index
 * @inner
 */
router.get('/', (req, res) => {
    res.render('index.html', {production: config.PRODUCTION, client_versobe: config.CLIENT_VERBOSE});
});

/**
 * Route to create a new document
 * @name post/create_document
 * @function
 * @memberof modules:routes/index
 * @inner
 */
router.post('/create_document', async (req, res) => {
    try {
        let documentId = await db.createDocument();
        res.redirect(`/editor/${documentId}`);
    } catch (err) {
        console.log(err);
        throw new Error(err);
    }
});

module.exports = router;
