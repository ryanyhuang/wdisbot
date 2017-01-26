'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
    res.send('Hello world, I am a chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'i_think_this_can_be_random_verify') {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
})

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})


app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging
    for (let i = 0; i < messaging_events.length; i++) {
        let event = req.body.entry[0].messaging[i]
        let sender = event.sender.id
        if (event.message && event.message.text) {
            let text = event.message.text
            main(text, sender);
            //sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))
        }
    
    }
    res.sendStatus(200)
})

const token = "EAAJ0vqdjwQQBACBLGkKAfqJFZCCBbXuDaZBf45Xl3pou2Jd0fUQ2G5tURMSEHhZCqvl724Db1EBB7haYHMwSFZA4RJGLcQd3KPuhmGHZBe3ZBxezqLGaXUWh122ZAap3Yk7lwKCFnyuwW4hpAHDbQ8udwhzxPZBlWr6r5u4KZBjSqaQZDZD"


function sendTextMessage(sender, text) {
    let messageData = { text:text }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

//vars=================================
var fs = require('fs');

var playerBase = require('./playerBaseOff.json');
var users = [];

//normal array with sorts after every insert/change
var PQ = [];

//{userID: , question: [question object]}
var beingAnswered = [];


function main(text, ID){
    console.log(text);
    console.log(ID);

    //var users = require('./users.json');
    var search = users.filter(function(obj){
        return obj.userID == ID;
    });
    if(search.length == 0){
        makeNewUser(ID);
        sendTextMessage(ID, "welcome message!");
        return;
    }

    var tokens = text.split(' ');

    if(tokens[0] === "question:" || tokens[0] === "Question:"){
        var result = processQuestion(tokens, ID);
        if(result == 1){
            sendTextMessage (ID, "question successfully submitted");
        }
        else if (result == -1){
            sendTextMessage (ID, "formatting error + usage");
        }
        else if (result == -2){
            sendTextMessage (ID, "player not found error + how to get players list");
        }
        else if (result == -3){
            sendTextMessage(ID, "you already asked this question");
        }
        //dup case, question object was returned
        else {
            sendTextMessage(ID, "responses so far: ");
            //would need to iterate and format this
            //sendTextMessage(result.responses);
        }

    }

    else if(tokens[0] === "request:" || tokens[0] === "Request:"){
        var result = serveQuestion(ID);
        if(result == -1){
            sendTextMessage(ID, "no available questions!");
        }
        else if(result == 1){
            sendTextMessage(ID, "you have 10 minutes to answer. format...");
        }

    }

    else if(tokens[0] === "answer:" || tokens[0] === "Answer:"){
        if(!processAnswer(tokens, ID)) sendTextMessage (ID, "formatting error + usage");
    }
    else if(tokens[0] == "list:"){
        //need error checking
        listPlayers(tokens[1]);
    }
    else if(tokens[0] === "diba:"){
        console.log(JSON.stringify(beingAnswered, null, 2));
    }
    else if(tokens[0] === "dipq:"){
        console.log(JSON.stringify(PQ, null, 2));
    }
    else if(tokens[0] === "diu:"){
        console.log(JSON.stringify(users,null,2));
    }

    else{
        sendTextMessage(ID, "command not recognized + usage");
    }

    console.log();
    console.log("====SEND ANOTHER MESSAGE====");

}

/* returns
 * [question object] (else case) for question has already been asked
 * 1 for success
 * -1 for failed formatting
 * -2 couldn't find player  
 * -3 already asked question
 *
 * question: cam newton or russell wilson?
 */
function processQuestion(tokens, senderID){
    console.log("processing question");
    if(!tokens[3] === "or" || tokens.length != 6){
        return -1;
    }
    var player1 = tokens[1] + " " + tokens[2];
    var player2 = tokens[4] + " " + tokens[5].substring(0, tokens[5].length-1);

    console.log("player1: %s and player2: %s", player1, player2);

    if(player1 == player2) return -2;

    //make sure both players exist in the players database
    var player1bool = playerBase.filter(function(obj){
        return obj.name == player1;
    }).length;
    var player2bool = playerBase.filter(function(obj){
        return obj.name == player2;
    }).length;

    //console.log("player1 length: %d, player2 length: %d", player1bool, player2bool);

    if(!player1bool || !player2bool){
        console.log("couldn't find one of the players");
        return -2;
    }

    //TODO====
    //query active questions, then retired questions for this pair
    //if from active, then add to askers array and server responses so far
    //else just serve responses, and rewrite retiredQuestions?
    var matching = PQ.filter(function(obj){
        return (obj.player1 == player1 && obj.player2 == player2)
            || (obj.player1 == player2 && obj.player2 == player1);
    });

    if(matching.length != 0){
        console.log("question already asked");
        if(matching[0].askerID.indexOf(senderID) == -1){
            matching[0].askerID.push(senderID);

        } else {
            console.log("already attached to question");
            return -3;
        }
        return matching[0];
    }
/*
    var retiredQs = require('./retiredQuestions.json');

    var matching = retiredQs.filter(function(obj){
        return obj.player1 == player1 && obj.player2 == player2;
        return obj.player1 == player2 && obj.player2 == player1;
    });

    if(matching.length != 0){
        console.log("question already asked");
        if(matching[0].askerID.indexOf(senderID) == -1){
            matching[0].askerID.push(senderID);

        } else {
            console.log("already attached to question");
            return -3;
        }
        fs.writeFile('./retiredQuestions.json', JSON.stringify(retiredQs, null, 2), function(err){});
        return matching[0];
    }
*/
    //at this point the question is legit and doesn't exist yet, so make it
    var newQuestion = makeNewQuestion(player1, player2, senderID);
    PQ.push(newQuestion);
    //pq simulation
    PQ.sort(function(a,b){
        return b.priority - a.priority;
    });
    //sort...
    return 1;

}

function serveQuestion(ID){
    //check to see if another question is already being answered
    var user = beingAnswered.filter(function(obj){
        return obj.userID == ID;
    });
    var active;
    if(user.length == 0){
        active = {
            userID: ID,
            question: [],
            out: false
        }
        beingAnswered.push(active);
    } else {
        active = user[0];
        if(active.out) active.question[0].currAns--;

    }
    //if empty, then make newACtive, or else roll with what gets pulled out of filter

    var index = 0;
    //search PQ for a question that doesnt already have 3 answerers, 
    //hasn't been asked to this person before, and wasn't asked by this person
    while(PQ[index].currAns == 3 || active.question.indexOf(PQ[index]) != -1
            ||PQ[index].askerID == ID || (PQ[index].responses.length + PQ[index].currAns) > 4){

        index++;
        if(PQ[index] == undefined){
            console.log("no available questions");
            active.out = false;
            return -1;
        }
    }
    var question = PQ[index];
    active.out = true;
    active.question.unshift(question);
    question.currAns++;

    var questionString = "Someone wants to know, should I start " 
                    + question.player1 + " or " + question.player2;
    sendTextMessage(ID, questionString);

    //make it so question becomes inactive after 10 minutes
    //start timer
    // at end of timer, if newActive is still in beingAnswered...
    setTimeout(function(){
        if(active.out == true && active.question[0] == question){
            active.out = false;
            active.question[0].currAns--;
            //message user? your question has expired...
            sendTextMessage(ID, "question expired");
        }
    }, 60*1000);


    return 1;
}



/* return
 * 1 for success
 * -1 for failed formatting
 * -2 for player not an option
 * -3 no active question to answer
 * -4 response not long enough
 *
 * 0. verify validty of response

 * 1. send response to asker
 * 2. add response to questions response list... update votes
 * 3. if it has 5 responses, then remove it from the PQ
 *      then write it to retiredQuestions.json
 *      give every question in PQ another 2 points
 * 4. then go to beingAnswered and change user's out to false
 * 5. and remove the question from his questions list (removeQuestion function?)
 * 6. if his questions list is now empty, then remove this entry from beingAnswered
 *
 * 7. give point to user in his json, and update all of users questions to have more points (SORT)
 * 8. message user telling him thank you and he earned a point
 * 
 */
function processAnswer(tokens, ID){
    console.log("processing answer");
    
}

function makeNewQuestion(player1, player2, ID){

    //each time question gets popped, give every question in queue two point.
    //priorities relative to each other stay the same

    //var users = require('./users.json');

    //query json to get priority
    var priority = users.filter(function(obj){
        return obj.userID == ID;
    })[0].points;

    var newQuestion = {
        askerID: [ID],
        priority: priority,
        currAns: 0, //times out after 5 mins, put question back into queue
                            //start timer and after timer ends checks to see if question is
                            //still in being answered array
        player1: player1,
        player2: player2,
        p1votes: 0,
        p2votes: 0,
        responses: []       
    }

    return newQuestion;
}

/* first time user messages bot, adds him to the list of users
 * sets points to 0 */
function makeNewUser(ID){
    //var users = require('./users.json');
    var newUser = {userID: ID, points: 0};
    users.push(newUser);
    //fs.writeFile('./users.json', JSON.stringify(users, null, 2), function(err){});
}

/*gives user point for answering quesiton
 * 1. updates in his entry in the users json
 * 2. gives all his questions in PQ another point
 * 3. sort pq
 */
function giveUserPoint(ID){

}

/*adds question to retired question json*/
function makeNewRetiredQuestion(question){

}

function listPlayers(where){
    var toPrint = playerBase;
    if(where == "RB" || where == "WR" || where == "TE" 
        || where == "QB" || where == "K" || where == "D"){
        toPrint = playerBase.filter(function(obj){
            return obj.pos == where;
        });
    }
    console.log(toPrint);
}