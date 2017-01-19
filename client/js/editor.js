import { Changes } from '../../collections/changes'
import { Template } from 'meteor/templating';
import { Random } from 'meteor/random'
import { EditUsers } from '../../collections/editusers'
import { Docs } from '../../collections/docs'
import { Session } from 'meteor/session'
import { Tracker } from 'meteor/tracker'

var fileName = "meme.py";
var username = "Guest"
var mongoId = null;
var userId = null ;
var lockTimeout = null;
var compressTimeout = null;
var userMarks = {};
var doc = null;

Template.EditorPage.onRendered(() => {
    doc = $('.CodeMirror')[0].CodeMirror;

    try {
      username = Meteor.user()['emails'][0]['address'];
    } catch(e) {} //tfw you're too lazy to be bothered with error handling

    var id = FlowRouter.getParam("editID");

    EditUsers.insert({name: username, editor: id, file: fileName, line: [-1, 0], revive: ''}, function(err, _id) {
        userId = _id;
        Session.set("userId", _id);
        Session.set("editing", true)
    });


    if(!Changes.find({session:id}).fetch().length) {
         Changes.insert({session:id, from:{}, to:{}, text:[], removed:[], origin:[], user:userId})
    }
    mongoId = Changes.find({session:id}).fetch()[0]['_id'];

    Changes.find({session:id}).observe({
       added: function (i) {
       },
       changed: function (changes, old) {
         if(changes['user'] != userId) {
           console.log(Changes.find({session: id}).fetch());
         }
       },
       removed: function (i) {
      }
    });

    function makeEdit(c, added) {
      //console.log(c)
      //console.log("edit detect");
      if(c['user'] != userId){
        //console.log(c['val']);
        var line = doc.getLine(c['line']);
        doc.replaceRange(c['val'], {line: c['line'], ch: 0}, {line: c['line'], ch: line.length}, origin='ignore');
        //var mark = doc.markText({line:c['line'],ch:0}, {line:c['line'],ch:doc.getLine(c['line']).length}, {className: "locked", readOnly: false});
        //console.log(mark);
      }
    }

    Docs.find({editor:id}).observe({
       added: function (c) {
          makeEdit(c, true);
       },
       changed: function (c, old) {
          makeEdit(c, true);
       },
       removed: function (c) {
         makeEdit(c, false)
      }
    });

    EditUsers.find({editor:id}).observe({
       added: function (i) {
       },
       changed: function (changes, old) {
         if(userMarks[changes['_id']]) {
           //userMarks[changes['_id']].clear();
         }
         if(changes['line'][0] != -1 && changes['_id'] != userId) {
            var a = changes['line'][0] //from
            var b = changes['line'][1]+a-1 //to
            //console.log(changes['line'])

            //var mark = doc.markText({line:a,ch:0}, {line:b,ch:doc.getLine(b).length}, {className: "locked"});
            //console.log(mark);
            //userMarks[changes['_id']] = mark;
         }
       },
       removed: function (i) {
        }
      });
});

Template.EditorPage.helpers({
  editorID() {
    return FlowRouter.getParam("editID");
  },

  editingUsers() {
    return EditUsers.find({editor: FlowRouter.getParam("editID")}).fetch();
  },

  editorOptions() {
      return {
          lineNumbers: true,
          mode: "python",
          theme: "night",
          keyMap: "vim",
          indentUnit: 4,
          indentWithTabs: true,
          autoCloseBrackets: true,
          matchBrackets: true,
          matchTags: true,
          autoCloseTags: true
      }
    },

    editorEvents() {
       return {
         "change": function(doc, change){
           if(change['origin'] != 'ignore'){
            //Changes.add(change)
            lineObj = [change['from']['line'], change['text'].length];
            change['user'] = userId;
            //console.log(change);
            var hash = Random.id(3)
            var a = lineObj[0] //from
            var b = lineObj[1]+a-1 //to
            EditUsers.update({_id:userId}, {$set: {line:lineObj, revive:hash}});
            //var mark = doc.markText({line:a, ch:0}, {line:b}, {className: "unlocked"});
            //setTimeout(function() {
            //  mark.clear();
            //}, 1000);

            clearTimeout(lockTimeout)
            lockTimeout = setTimeout(function() {
                EditUsers.update({_id:userId}, {$set: {line:[-1,0]}});
            }, 1000);

            clearTimeout(compressTimeout);
            if(lineObj[1] > 1) {
              compressTimeout = setTimeout(function() {
                  var oldRange = EditUsers.find({_id:userId}).fetch()[0]['line']
                  var l = doc.getCursor()['line'];
                  if(l > oldRange[0] && l < oldRange[0]+oldRange[1]) {
                    EditUsers.update({_id:userId}, {$set: {line:[l,1]}});
                  }
              //    mark.clear();
              }, 500);
            }

            /*if(change['origin'] != 'ignore') {
              Changes.update(mongoId, {$set: change});
            }*/

            var editorId = FlowRouter.getParam("editID");
            //console.log(change['origin']);
            for(var q=0; q < lineObj[1]; q++) {
              //console.log(a+q);
              docs = Docs.find({line:a+q, file:fileName, editor:editorId}).fetch()
              if(docs.length) {
                Docs.update({_id: docs[0]['_id']}, {$set: {user: userId, val: doc.getLine(a+q)}});
              } else {
                Docs.insert({user: userId, val: doc.getLine(a+q), line: a+q, editor: editorId, file:fileName});
              }
            }
          }
         },
        "cursorActivity": function(doc) {
            //console.log("cursor moved");
        }
      }
    },

  editorCode() {
      return '';
  }
});

Template.EditorPage.onDestroyed(function() {
  EditUsers.remove({_id : userId});
});
