var express = require('express');
var router = express.Router();
var mongo = require('mongodb').MongoClient;
//var objectId = require('mongodb').ObjectID;
var assert = require('assert');
var request = require('request');
var fs = require('fs');
var formidable = require('formidable');

var errorsList = [];
var currentUser = '';
var snipsMade = [];
var url = 'mongodb://localhost:27017/delta';
var proceed = true;

/* GET root page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Snippy', errors: errorsList});
});

/* GET home page. */
router.get('/home', function(req, res, next) {
	snipsMade.splice(0, snipsMade.length);
	if(currentUser.length > 0){
		
		
		mongo.connect(url, function(err, db){
			assert.equal(null, err);

			var cursor = db.collection('snippets').find({author: currentUser});

			cursor.forEach(function(doc, err){
  			assert.equal(null, err);
  			
  			snipsMade.push(doc);
  		}, function(){
  			db.close();
  			res.render('home', { title: 'home', user: currentUser, snips: snipsMade});
  		});

		});
  	
	}
  else{
  	res.redirect('/');
  }
});

/*GET logout page*/
router.get('/logout', function(req, res, next){
	currentUser = '';
	snipsMade.splice(0, snipsMade.length);
	res.redirect('/');
});

/*GET register page*/
router.get('/register', function(req, res, next){
  res.render('register', { title: 'Register'});


});

/*POST submit page for registering*/
router.post('/submit', function(req, res, next){
	mongo.connect(url, function(err, db){
		assert.equal(null, err);
		
		if(req.body.check == '0,0,0,0'){

			var secretKey = "6Ld30SYUAAAAAK5w-_U9BTLkhv_-L7npYs-WvVuM";
			var verificationUrl = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.body['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;

			request(verificationUrl,function(error,response,body) {
   			body = JSON.parse(body);
    		console.log("request captcha thing")
    		if(body.success !== undefined && !body.success) {
      		console.log("Failed Captcha verification");
      		db.close();
      		res.render('register', { title: 'REGISTER', email: req.body.email, user: req.body.username, msg: "CAPTCHA verification failed"})
  	 		}
  	 		else{
  	 			var new_user = {
						email: req.body.email,
						username: req.body.username,
						password: req.body.password
					}
					db.collection('users').insertOne(new_user, function(error, result){
						assert.equal(null, error);
						console.log('user inserted');
						db.close();
						res.redirect('/');
					});
  	 		}
  		});
			
		} else{
			db.close();
			res.render('register', { title: 'REGISTER', email: req.body.email, user: req.body.username, msg: "Please check fields for errors and re-enter accordingly"});
		}


	});
});

/*POST login page*/

router.post('/login', function(req, res, next){

	errorsList.splice(0, errorsList.length);
	var invalid = true;

	mongo.connect(url, function(err, db){
		assert.equal(null, err);
		var cursor = db.collection('users').find( { username: req.body.username});
		cursor.forEach(function(doc, err){
  		assert.equal(null, err);
  		
  		if(doc.username==req.body.username && doc.password==req.body.password){
  			invalid = false;
  			
  		}
  	}, function(){
  		db.close();
  		if(invalid){
				errorsList.push("Invalid Username and/or Password. Please Try Again");
				res.redirect('/');
			}
			else{
				currentUser = req.body.username;
				res.redirect('/home');
			}
  	});
	});
});


/*POST availability page for AJAX checking of username and email*/
router.post('/availability', function(req, res, next) {
	var toCheck = Object.keys(req.body)[0];
	var format = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;
	var result = 'taken';

	mongo.connect(url, function(err, db){
		assert.equal(null, err);

		if(toCheck[0] == 'u')
			var cursor = db.collection('users').find({username: toCheck.slice(1)});
		else if(toCheck[0] == 'e')
			var cursor = db.collection('users').find({email: toCheck.slice(1)});
		
		cursor.count().then(function(num){
			if(num > 0){
				result = 'taken';
				proceed = false;
			}
			else{
				result = 'available';
				proceed = true;
			}
			if((format.test(toCheck) || toCheck == 'u') && toCheck[0] == 'u'){
				result = 'special';
				proceed = false;
			}
			db.close();
			res.writeHead(200, {'Content-Type': 'text/html'});
  		res.end(result);
		});
	});
});

/*POST save page to save snippet*/
router.post('/save', function(req, res, next){
  
	mongo.connect(url, function(err, db){
		assert.equal(null, err);
		do{
			var used = false;
			var newcode = randomString();
			var cursor = db.collection('snippets').find({code: newcode});
			cursor.count().then(function(num){
				if(num > 0){
					used = true;
				}
				else{

					var item = {
					title: req.body.sniptitle,
					author: currentUser,
					content: req.body.snippet,
					code: newcode,
					privacy: req.body.privacy,
					anonimity: req.body.anonimity,
					language: req.body.language,
					creation: Date.now(),
					expiry: Date.now()+parseInt(req.body.expiration)
					}
					db.collection('snippets').insertOne(item, function(error, result){
						assert.equal(null, error);
						console.log('snippet inserted');
						db.close();
						res.redirect('/'+item.code);
					});
				}
			});
		}while(used);
	});
});

/*GET snippet */

router.get(/.{8}/, function(req, res, next){
		
	var resultArray = [];
	console.log('snipcode below');
	console.log(req.path.slice(1));
  	mongo.connect(url, function(err, db){
  	assert.equal(null, err);

  	var cursor = db.collection('snippets').find({code: req.path.slice(1)});

  	cursor.forEach(function(doc, err){
  		assert.equal(null, err);
  		resultArray.push(doc);
  	}, function(){
  		

  		if(resultArray.length > 0){
  			if(resultArray[0].creation > resultArray[0].expiry || Date.now() < resultArray[0].expiry){
  				db.close();
		  		if(resultArray[0].author == currentUser || resultArray[0].privacy == 'public'){
		  			
		  			if(resultArray[0].anonimity == 'true'){
		  				console.log('name is rendered');
		  				res.render('snippet', {item: resultArray[0], display: true, anon: true});
		  			}
		  			else
		  				res.render('snippet', {item: resultArray[0], display: true, anon: false});
		  		}
		  		else{
		  			res.render('snippet', {display: false})
		  		}
		  	}
		  	else{
		  		db.collection('snippets').deleteOne({'_id': resultArray[0]._id}, function(error, result){
					assert.equal(null, error);
					console.log('item deleted');
					db.close();
					res.render('error', {message: "This snippet doesn't exist"})
				});
		  	}
	  	}else{
	  		res.render('error', {message: "This snippet doesn't exist"})
	  	}
  	});
  });
});


/*POST upload snippet*/
router.post('/upload', function(req, res, next){
	var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
  	if(err)throw err;
    console.log('File uploaded');
    console.log(files.filetoupload.path);

    fs.readFile(files.filetoupload.path, function(err, data) {
    	if(err) throw err;
	    
	    res.render('home', { title: 'Home', user: currentUser, snips: snipsMade, fileupload: data});
	    
  });
    
  });
});

function randomString() {
	  var length = '7'
    var result = '';
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
    return result;
}

module.exports = router;
