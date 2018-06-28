'use strict';

const rp = require('request-promise');
const moment = require('moment');
const AWS = require('aws-sdk');
const querystring = require("querystring");
const arraySort = require('array-sort');

const helper = require('./helper');

function getHashtagSuggestions(post, clientId, urlApi) {
  const result = querystring.stringify({'tags':post, 'client_id':clientId});
  const url = urlApi + "multiple-hashtags?"+result;
  return rp({
    method: 'GET',
    uri: url,
    json: true
  });
}

function getAutoHashtag(post, clientId, urlApi) {
  const result = querystring.stringify({'post':post, 'client_id':clientId, 'maxHashtags':'2', 'hashtagPosition':'auto'});
  const url = urlApi + "auto-hashtag?"+result;
  return rp({
    method: 'GET',
    uri: url,
    json: true
  });
}

function convertToString(detectLabels){
  var result = "";
  for (var i = 0, len = detectLabels.Labels.length; i < len; i++) {
    var label = detectLabels.Labels[i].Name;
    result += label + ",";
  }
  return result.slice(0, -1);
}

function processTags(detectTagsStats){
  var sortedArray = arraySort(detectTagsStats, ['exposure', 'retweets'],{reverse: true});
  return sortedArray.filter(function (el) {
    return el.color >= 2 &&
           el.exposure >= 10000;
  });
};

function processCaption(caption, detectTagsStats){
  var result = (caption ? caption : "");
  for (var i = 0, len = detectTagsStats.length; i < len; i++) {
    var tag = detectTagsStats[i].hashtag;
    if(result === ""){
      result += "#" + tag;
    } else {
      result += " #" + tag;
    }
  }
  return result;
}

function processTagScore(detectTagsStats){
  var result = "";
  for (var i = 0, len = detectTagsStats.length; i < len; i++) {
    var tag = detectTagsStats[i].hashtag;
    var exposure = detectTagsStats[i].exposure;
    var retweets = detectTagsStats[i].retweets;
    var tweets = detectTagsStats[i].tweets;
    result += "#" + tag + "(exposure: "+exposure+", retweets: "+retweets+", tweets: "+tweets+")\n";
  }
  return result;
}

module.exports.main = (event, context, callback) => {
  const env_variables = {
    BOT_NAME: process.env.BOT_NAME,
    BOT_ALIAS: process.env.BOT_ALIAS,
    API_GATEWAY_URL: process.env.API_GATEWAY_URL,
    TELEGRAM_API: process.env.TELEGRAM_API,
    AWS_REGION: process.env.MY_AWS_REGION,
    API_FILE_GATEWAY_URL: process.env.API_FILE_GATEWAY_URL,
    SNS_TOPIC_LEX: process.env.SNS_TOPIC_LEX,
    API_RITEKIT_URL:process.env.API_RITEKIT_URL,
    RITEKIT_API:process.env.RITEKIT_API,
  }

  console.log("env_variables", env_variables)
  console.log("event", JSON.stringify(event))

  const message = JSON.parse(event.Records[0].Sns.Message);

  console.log("message", message)

  // File
  var file_id = message.file_id;
  console.log("file_id", file_id)


  var message_text = message.message_text;
  console.log("message_text", message_text);

  // Chat ID
  var chatId = message.chatId;
  console.log("chatId", chatId)

  // From
  var userNumber = message.userNumber;
  console.log("userNumber", userNumber)

  // message_id
  var message_id = message.message_id;
  console.log("message_id", message_id)

  // last_name
  var last_name;
  if (message.last_name) {
    last_name = message.last_name;
  } else {
    last_name = message.lastname;
  }
  console.log("last_name", last_name)

  // first_name
  var first_name;
  if (message.first_name) {
    first_name = message.first_name;
  } else {
    first_name = message.firstname;
  }
  console.log("first_name", first_name)

  // detectLabels
  var detectLabels;
  if (message.detectLabels) {
    detectLabels = message.detectLabels;
  } else {
    detectLabels = message.detectLabels;
  }
  console.log("detectLabels", detectLabels)

  var response = {
    statusCode: 200,
    body: JSON.stringify({
      message: '',
      input: event,
    }),
  };

  if (chatId) {

    var lex_message = "Hello car"
    var keyboard = {}
    var config = {}

    var hashtags = convertToString(detectLabels);

    var promisearr = [];
    promisearr.push(getHashtagSuggestions(hashtags, env_variables.RITEKIT_API, env_variables.API_RITEKIT_URL));
    if(message_text) promisearr.push(getAutoHashtag(message_text, env_variables.RITEKIT_API, env_variables.API_RITEKIT_URL));

    Promise.all(promisearr).then((data) => {
      var lex_message1 = "";
      lex_message = "";
      if(data[1]){
        console.log("getAutoHashtag:", JSON.stringify(data[1]));
        lex_message = data[1].post;
      };
      if(data[0]){
        console.log("getHashtagSuggestions:", JSON.stringify(data[0]));
        var hashtagStats = processTags(data[0].stats);
        lex_message  = "*Caption:*\n"+ processCaption(lex_message, hashtagStats);
        lex_message1 = "*Tag Score:*\n" + processTagScore(hashtagStats);
      };
      var msgArr = [];
      msgArr.push(helper.sendMessageToTelegram(chatId, message_id, lex_message, env_variables.API_GATEWAY_URL, null));
      if(lex_message1 !== ""){
        msgArr.push(helper.sendMessageToTelegram(chatId, message_id, lex_message1, env_variables.API_GATEWAY_URL, null));
      }
      return Promise.all(msgArr);
    }).then((body) => {
      console.log("No of success message send", body.length, body);
      response.message = "success message send";
      callback(null, response);
    }).catch((err) => {
      response.statusCode =  400
      response.message = "Error"
      console.log("error", err)
      callback(err, "error");
    });

  } else {
    response.statusCode = 400
    response.message = "No chatId"
    callback(response, "failed");
  }

  callback(null, response);

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};
