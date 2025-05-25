var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('introduction');
});

/* GET about page. */
router.get('/about', function(req, res, next) {
  res.render('about');
});

/* GET test page. */
router.get('/test', function(req, res, next) {
  res.render('test');
});

module.exports = router;
