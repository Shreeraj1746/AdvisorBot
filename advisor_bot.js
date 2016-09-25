// import botkit
var Botkit = require('botkit');

// get authorization tokens from environment file
require('./env.js');

if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

if (!process.env.wit) {
  console.log('Error: Specify wit server token in environment')
}

// top level controller object used to spawn bots and respond to events
var controller = Botkit.slackbot({
  json_file_store: './db_advisor_bot/',
}).configureSlackApp(
  {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    scopes: ['bot'],
  }
);

// import witai middleware
var wit = require('botkit-middleware-witai')({
  token: process.env.wit
});

// setup webserver and webhook endpoints
controller.setupWebserver(process.env.port,function(err,webserver) {
  controller.createWebhookEndpoints(controller.webserver);

  webserver.get('/', function(req,res) {
    res.sendFile('index.html', {root: __dirname});
  });

// create Oauth endpoints
controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
  if (err) {
    res.status(500).send('ERROR: ' + err);
  } else {
    res.send('Success!');
  }
 });
});

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {};
function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

// bot creation event
controller.on('create_bot',function(bot,config) {

  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function(err) {

      if (!err) {
        trackBot(bot);
      }

      bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
        if (err) {
          console.log(err);
        } else {
          convo.say('I am a bot that has just joined your team');
          convo.say('You must now /invite me to a channel so that I can be of use!');
        }
      });
    });
  }
});

// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});


// enable witai mmiddleware
controller.middleware.receive.use(wit.receive);

// use middleware to process message and infer intent
controller.hears(['hello'], 'direct_message', wit.hears, function(bot, message) {
  bot.reply(message,"Hello! How can I help?");
});

// end conversation
controller.hears(['goodbye'],'direct_message', wit.hears, function(bot,message) {
  bot.reply(message,'Goodbye');
  bot.rtm.close();
});

// begin a conversation
controller.hears(['question'], 'direct_message', wit.hears, function(bot, message) {
  bot.reply(message,'Happy to help. What is your question?');
});

// entry point for question 1
controller.hears(['rules'], 'direct_message', wit.hears, function(bot, message){
  bot.reply(message, "Good question!");
  bot.startConversation(message, askContext);
});

// entry point for question 2
controller.hears(['transfer student'], 'direct_message', wit.hears, function(bot, message){
  bot.reply(message, "I am glad you asked!");
  bot.reply(message, "1. Make sure to attend one of the campus Transfer Orientation sessions, as described in the material sent to you by the university upon your acceptance.");
  bot.reply(message, "2. If you still have queries, make an appointment to resolve any unresolved issues with the appropriate advisor, as listed on the CS department advising web site. [http://www.sjsu.edu/cs/practicalities/cs-advising/]");    
  bot.reply(message, "3. Determine, preferably in consultation with an advisor, whether you are ready to start upper-division coursework in Computer Science.");
  bot.startConversation(message, askQ4);
});

askQ4 = function(response, convo){
  convo.ask("4. Have you successfully completed equivalents of CS 46A and CS 46B that use the Java language?", function(response, convo) {
    convo.say("Ok.");

    if (response.text.toLowerCase().match(/.*ye*./) || response.text.toLowerCase().match(/.*have[^n][^n]/)){
      convo.say("Then you have the computing background needed for CS 146 (Data Structures and Algorithms) and CS 151 (Object-Oriented Design).  You should consider taking these courses in your first semester at SJSU if you have met their mathematics prerequisites.");
      askQ7(response, convo);
      convo.next();
    }

    else{
      askQ5(response, convo);
      convo.next();
    }
  });
}

askQ5 = function(response, convo){
  convo.ask("5. Have you successfully completed equivalents of CS 46A and CS 46B that use a language other than Java?", function(response, convo){
    convo.say("In that case...");

    if (response.text.toLowerCase().match(/.*ye.*/) || response.text.toLowerCase().match(/.*have[^n][^n]/)){
      convo.say("You should enroll in CS 49J (Programming in Java) as soon as possible. After completing CS 49J successfully, you should take CS 146 and CS 151 as soon as you can.");
      askQ7(response, convo);
      convo.next();
    }

    else{
      askQ6(response, convo);
      convo.next();
    }
  });
}

askQ6 = function(response, convo){
  convo.ask("6. Have you successfully completed a CS 46A equivalent but not a CS 46B equivalent?", function(response, convo){
    convo.say("Ok.");

    if (response.text.toLowerCase().match(/.*ye.*/) || response.text.toLowerCase().match(/.*have[^n][^n]/)){
      convo.say("Then if the CS 46A equivalent used Java you may enroll in CS 46B.");
      askQ7(response, convo);
      convo.next();
    }
    
    else{
      convo.say("If you have not successfully completed a CS 46A equivalent, then you should enroll in CS 46A.");
      convo.say("You may instead, take a 46B equivalent at the same institution where you took your 46A equivalent, and then follow the instructions above for students whose 46A and 46B equivalencies didn't use Java.");
      convo.say("A third possibility is to simply take CS 46A at SJSU.  Your 46A will almost certainly count as equivalent to CS 49C if it used C or C++, and will likely count as an elective for the CS majo");
      askQ7(response, convo);
      convo.next();
    }
  });
}

askQ7 = function(response, convo){
  convo.say("7. Determine which General Education (GE) and Physical Education requirements apply to you.");
  convo.ask("Are you a second baccalaureate student?", function(response, convo){
    convo.say("Got it.");

    if (response.text.toLowerCase().match(/.*ye.*/) || response.text.toLowerCase().match(/.*am[^n][^n]/)){
      convo.say("Then you need not complete any of the Core GE or physical education requirements.");
      convo.say("However, you are subject to the American Institutions requirement in US and California history and government, if you haven't completed it already.");
      convo.say("For more information about General Education requirements, check the Schedule of Classes. Select the appropriate semester's Policies and Procedures, and then follow the General Education (GE) link. [http://info.sjsu.edu/home/schedules.html]");
      askIfDone(response, convo);
      convo.next();
    }

    else {
      askQ7b(response, convo);
      convo.next();
    }
  });
}

askQ7b = function(response, convo){
  convo.ask("Do you have a baccalaureate from a regionally accredited US university?", function(response, convo){
        
    if (response.text.toLowerCase().match(/.*ye.*/) || response.text.toLowerCase().match(/.*do[^n][^n]/)){
      convo.say("Then you needn't complete any of the SJSU Studies requirements, except for CS 100W and Phil 134, which are required courses in the BSCS.");
      convo.say("You will need to complete the 'additional science' course requirement of the BSCS, which many students complete with an SJSU studies course.");
      convo.say("For more information about General Education requirements, check the Schedule of Classes. Select the appropriate semester's Policies and Procedures, and then follow the General Education (GE) link. [http://info.sjsu.edu/home/schedules.html]");
      askIfDone(response, convo);
      convo.next();
    }

    else{
      convo.say("If you are not a second baccalaureate student, then you are responsible for all of the General Education requirements.");
      convo.say("The Registrar's office will determine which of your transfer courses will count as SJSU GE courses.");
      convo.say("For more information about General Education requirements, check the Schedule of Classes. Select the appropriate semester's Policies and Procedures, and then follow the General Education (GE) link. [http://info.sjsu.edu/home/schedules.html]");
      askIfDone(response, convo);
      convo.next();
    }
  });
}


askContext = function(response, convo) {
  convo.ask("Is this issue related to Computer Science or something else?", function(response, convo) {
    convo.say("Ok.");

    if (response.text.toLowerCase().match(/.*compu.*/) || response.text.toLowerCase().match(/.*cs.*/)){

      convo.say("For most CS issues, you should start with the appropriate advisor, as given on the CS advising web page. Link: http://www.sjsu.edu/cs/practicalities/cs-advising/");
      convo.say("For more complicated CS issues, or if you have problems with your graduation, you may consult the undergraduate coordinator. Link: http://www.sjsu.edu/cs/community/index.html.");
      convo.say("If you have problems with your graduation, you should see the undergraduate coordinator.");
      convo.say("Appointments may be made with the department chair through the CS department office in MH 208. ");

      askIfDone(response, convo);
      convo.next();
    }
    else{

      convo.say("For other assistance");
      convo.say('');
      convo.say('Many university facilities also stand ready to assist you. These include:');
      convo.say('1. The College of Science Advising Center [http://www.sjsu.edu/cosac/]');
      convo.say('2. Peer Connections (for tutoring)[http://peerconnections.sjsu.edu/]');
      convo.say('3. The SJSU Writing Center [http://www.sjsu.edu/writingcenter/]');
      convo.say('4. The SJSU Advising Hub [http://www.sjsu.edu/advising/]');
      convo.say('5. Academic Advising & Retention Services [http://www.sjsu.edu/aars/]');
      convo.say('6. SJSU Counseling and Psychological Services [http://www.sjsu.edu/counseling/]');
      convo.say('7. The SJSU Career Center [http://www.sjsu.edu/careercenter/index.html]');
      convo.say('8. The Division of Student Affairs [http://www.sjsu.edu/studentaffairs/]');

      askIfDone(response, convo);
      convo.next();

    }
  });
}

askIfDone = function(response, convo) { 
  convo.ask("Does that answer your question?", function(response, convo) {

    if (response.text.toLowerCase().match(/.*ye.*/)
      || response.text.toLowerCase().match(/.*sure.*/)
      || response.text.toLowerCase().match(/.*thank.*/)
      || response.text.toLowerCase().match(/.*does.*/)){

      convo.say("Glad I could help!");  
      convo.say("See you.");
      convo.next();
    }
    else{

      convo.say("No problem! Let's try again.")
      convo.say("Do you need help or have a question?");
      convo.next();
      
      controller.hears(['question'], 'direct_message', wit.hears, function(bot, message) {
      bot.reply(message,'Happy to help. What is your question?');
      });
    }
  });
}

controller.storage.teams.all(function(err,teams) {

  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (var t  in teams) {
    if (teams[t].bot) {
      controller.spawn(teams[t]).startRTM(function(err, bot) {
        if (err) {
          console.log('Error connecting bot to Slack:',err);
        } else {
          trackBot(bot);
        }
      });
    }
  }

});
