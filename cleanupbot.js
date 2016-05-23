var
    RtmClient = require('@slack/client').RtmClient,
    tokens = require('./tokens')
    token = tokens.SLACK_API_TOKEN, //put your token in a file named "tokens.js"
    rtm = new RtmClient(token, {loglevel: 'debug'}),
    WebClient = require('@slack/client/lib/clients/web/client'),
    web = new WebClient(token),
    Slack = require('slack-node'),
    slack = new Slack(token);

var
  stage = 0,
  current_user = "",
  channel = "",
  formatted_text = "",
  user_list = {};

rtm.start();

var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;


var get_users = function(){
  slack.api("users.list", {
    token: token,
  }, function(err, res){
    members = res.members;
    var associative_members_array = {};
    for (var i = 0; i < members.length; i++) {
      associative_members_array[members[i].id] = (members[i].real_name !== '') ? members[i].real_name : members[i].name;
    }
    user_list = associative_members_array
  });
}

get_users();

var make_mention = function(userID){
  return '<@' + userID + '>';
}


var is_direct_mention = function( mentioned_userID, mentioning_message){
  var mentioned_user_tag = make_mention(mentioned_userID);
  return typeof mentioning_message !== 'undefined' &&
    mentioning_message.includes(mentioned_user_tag);
}

var epoch_to_date = function(epoch_string){
  epoch_string = epoch_string * 1000;
  var time_sent = new Date(epoch_string);
  var
    year = time_sent.getFullYear(),
    month = time_sent.getMonth() + 1,
    day = time_sent.getDate(),
    hour = time_sent.getHours(),
    minute = time_sent.getMinutes();
  time_string = month + "/" + day + "/" + year +
  " " + hour + ":" + ((minute.length < 2) ? "0" + minute : minute);
  return time_string;
}

function format_messages(messages, callback){
    formatted_text = "";
    messages.reverse();
    for (i = 0; i < messages.length; i++) {
      var userName = user_list[messages[i].user];
      var message_text = messages[i].text.replace( rtm.activeUserId, user_list[rtm.activeUserId] );
      formatted_text += "# " + userName + "\n" +
      "### " + epoch_to_date(messages[i].ts) + "\n" +
      ">" + message_text.replace(/\n/g, "\n>") + "\n";
    }
    return;
  }

function parse_messages(raw_message){
  raw_message = raw_message.replace( make_mention(rtm.activeUserId) + ": ", "");
  message = raw_message.split(" ");
  date = new Date(message[0], message[1] - 1, message[2], message[3], message[4], 0, 0).getTime() / 1000;

  slack.api("channels.history", {
    token: token,
    channel: channel,
    oldest: date,
    count:1000
  }, function(err, response){

    format_messages(response.messages);

    var date_title = new Date() + ""; //make into string
    date_title_array = date_title.split(" ")
    formatted_date =
      date_title_array[0] + " " + //day of week
      date_title_array[1] + " " + //month
      date_title_array[2] + " " + //day
      date_title_array[3] + " " + //year
      date_title_array[4]; //time

    slack.api('files.upload', {
     channels: [channel],
     title: "Conversation From: " + formatted_date,
     content: formatted_text,
     filetype: "post",
     display_as_bot: "true"
    }, function(err, response){
      console.log("upload success");
    });
  });
}


rtm.on(RTM_EVENTS.MESSAGE, function(message){

  channel = message.channel;

  switch (stage) {
    case 0:
      if( is_direct_mention(rtm.activeUserId, message.text) ){
        current_user = message.user;
        rtm.sendMessage("Looks Like you need some help cleaning up."
        + "\n Send me another message with the date and time of the post you would like me to start cleaning at!"
        + "\n The format should be: ```@cleanupbot: Year  Month  Day  Hour(24 hour format)  Minute```", message.channel)
      stage++;
      }
      break;
    case 1:
      if( is_direct_mention(rtm.activeUserId, message.text) && message.user == current_user ){
        parse_messages(message.text)
      }
      stage++;
      break;
    default:
      stage = 0;
      current_user = "";
      channel = "";
      break;
  }
});
