var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Home', error: "false" });
});


router.post('/login', function(req, res) {
	var error = "false";
	res.render('index', { title: 'Home', error: error });
});

module.exports = router;
