FlowRouter.route('/quickstart', {
    action: function(params) {
        console.log("render editor");
        BlazeLayout.render('EditorPage');
    }
});
