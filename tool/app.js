window.baseFBUrl = 'https://ttuuvv.firebaseio.com/';
window.onload=function(){
    (function (jQuery, Firebase, Path) {
        "use strict";
        // the main firebase reference
        window.rootRef = new Firebase(window.baseFBUrl);
        window.usersRef = new Firebase(window.baseFBUrl + 'user_data');
        window.actionLogsRef = new Firebase(window.baseFBUrl + 'action_logs');
        window.userInfo = {};

        // pair our routes to our form elements and controller
        var routeMap = {
            '#/': {
                form: 'frmLogin',
                controller: 'login'
            },
            '#/logout': {
                form: 'frmLogout',
                controller: 'logout'
            },
            '#/register': {
                form: 'frmRegister',
                controller: 'register'
            },
            '#/createUser': {
                form: 'frmCreateUser',
                controller: 'createUser'
            },
            '#/profile': {
                form: 'frmProfile',
                controller: 'profile',
                authRequired: true // must be logged in to get here
            },
            '#/task': {
                form: 'todo-form',
                controller: 'task',
                authRequired: true // must be logged in to get here
            }
        };

        // create the object to store our controllers
        var controllers = {};

        // store the active form shown on the page
        var activeForm = null;

        var alertBox = $('#alert');

        function routeTo(route) {
            window.location.href = '#/' + route;
        }

        // Handle third party login providers
        // returns a promise
        function thirdPartyLogin(provider) {
            var deferred = $.Deferred();

            rootRef.authWithOAuthPopup(provider, function (err, user) {
                if (err) {
                    deferred.reject(err);
                }

                if (user) {
                    deferred.resolve(user);
                }
            });

            return deferred.promise();
        };

        // Handle Email/Password login
        // returns a promise
        function authWithPassword(userObj) {
            var deferred = $.Deferred();
            rootRef.authWithPassword(userObj, function onAuth(err, user) {
                if (err) {
                    deferred.reject(err);
                }

                if (user) {
                    deferred.resolve(user);
                }

            });
            return deferred.promise();
        }

        // create a user but not login
        // returns a promsie
        function createUser(userObj) {
            var deferred = $.Deferred();
            rootRef.createUser(userObj, function (err) {

                if (!err) {
                    deferred.resolve();
                } else {
                    deferred.reject(err);
                }

            });

            return deferred.promise();
        }

        // Create a user and then login in
        // returns a promise
        function createUserAndLogin(userObj) {
            return createUser(userObj)
            .then(function () {
                return authWithPassword(userObj);
            });
        }

        // authenticate anonymously
        // returns a promise
        function authAnonymously() {
            var deferred = $.Deferred();
            rootRef.authAnonymously(function (err, authData) {

                if (authData) {
                    deferred.resolve(authData);
                }

                if (err) {
                    deferred.reject(err);
                }

            });

            return deferred.promise();
        }

        // route to the specified route if sucessful
        // if there is an error, show the alert
        function handleAuthResponse(promise, route) {
            $.when(promise)
            .then(function (authData) {

                // route
                routeTo(route);

            }, function (err) {
                console.log(err);
                // pop up error
                showAlert({
                    title: err.code,
                    detail: err.message,
                    className: 'alert-danger'
                });

            });
        }

        // options for showing the alert box
        function showAlert(opts) {
            var title = opts.title;
            var detail = opts.detail;
            var className = 'alert ' + opts.className;

            alertBox.removeClass().addClass(className);
            alertBox.children('#alert-title').text(title);
            alertBox.children('#alert-detail').text(detail);
        }

        /// Controllers
        ////////////////////////////////////////

        controllers.login = function (form) {

            // Form submission for logging in
            form.on('submit', function (e) {

                var userAndPass = $(this).serializeObject();
                var loginPromise = authWithPassword(userAndPass, function(error, authData) {
                  if (error) {
                    console.log("Login Failed!", error);
                  } else {
                    console.log("Authenticated successfully with payload:", authData);
                  }
                },{
                  remember: "sessionOnly"
                });
                e.preventDefault();

                handleAuthResponse(loginPromise, 'profile');

            });

            // Social buttons
            form.children('.bt-social').on('click', function (e) {

                var $currentButton = $(this);
                var provider = $currentButton.data('provider');
                var socialLoginPromise;
                e.preventDefault();

                socialLoginPromise = thirdPartyLogin(provider);
                handleAuthResponse(socialLoginPromise, 'profile');

            });

            form.children('#btAnon').on('click', function (e) {
                e.preventDefault();
                handleAuthResponse(authAnonymously(), 'profilex');
            });

        };

        // logout immediately when the controller is invoked
        controllers.logout = function (form) {
            rootRef.unauth();
        };

        controllers.register = function (form) {

            // Form submission for registering
            form.on('submit', function (e) {

                var userAndPass = $(this).serializeObject();
                var loginPromise = createUserAndLogin(userAndPass);
                e.preventDefault();

                handleAuthResponse(loginPromise, 'profile');

            });

        };

        controllers.createUser = function (form) {

            // Form submission for registering
            form.on('submit', function (e) {

                var userAndPass = $(this).serializeObject();
                var deferred = $.Deferred();
                rootRef.createUser(userAndPass, function (err) {

                    if (!err) {
                        deferred.resolve();
                    } else {
                        deferred.reject(err);
                    }

                });
                var emailKey = userAndPass.email.replace(/[^a-z0-9 -]/g, ''),
                    userRef = rootRef.child('users').child(emailKey),
                    newMessageRef = usersRef.child("emails").child(emailKey);
                newMessageRef.set({email: userAndPass.email});

                userRef.set({
                    'name': userAndPass.name,
                    'type': userAndPass.type
                }, function onComplete() {

                    // show the message if write is successful
                    showAlert({
                        title: 'Successfully saved!',
                        detail: 'You are still logged in',
                        className: 'alert-success'
                    });

                });

            });

        };

        controllers.profile = function (form) {
            // Check the current user
            var user = rootRef.getAuth();
            var userRef;

            // If no current user send to register page
            if (!user) {
                routeTo('register');
                return;
            }

            var emailKey = user.password.email.replace(/[^a-z0-9 -]/g, ''),
                newMessageRef = usersRef.child("emails").child(emailKey);
            newMessageRef.set({email: user.password.email, 'uid': user.uid});
            // We've appended a new message to the message_list location.
            console.log(newMessageRef.toString());
            window.userInfo = {
                'user': user.password,
                'profile': {}
            };

            // Load user info
            userRef = rootRef.child('users').child(user.uid);
            userRef.once('value', function (snap) {
                var user = snap.val();
                if (!user) {
                    return;
                }

                // set the fields
                form.find('#txtName').val(user.name);
                form.find('#txtType').val(user.type);

                window.userInfo.profile = user;

                if(window.userInfo != undefined &&
                    (window.userInfo.profile.type == undefined || window.userInfo.profile.type != 'Admin')
                ){
                    $('.userType').hide();
                    $('#frmCreateUser').hide();
                } else {
                    $('.userType').show();
                    $('#frmCreateUser').hide();
                }
            });
            // Save user's info to Firebase
            form.on('submit', function (e) {
                e.preventDefault();
                var userInfo = $(this).serializeObject();

                userRef.set(userInfo, function onComplete() {

                    // show the message if write is successful
                    showAlert({
                        title: 'Successfully saved!',
                        detail: 'You are still logged in',
                        className: 'alert-success'
                    });

                });
            });
        };

        controllers.task = function (form) {
            // Check the current user
            var user = rootRef.getAuth();
            var userRef;

            // If no current user send to register page
            if (!user) {
                routeTo('register');
                return;
            }

            todo.init();

            // Load user info
            //userRef = rootRef.child('users').child(user.uid);
            //load older conatcts as well as any newly added one...
            usersRef.child("emails").on("child_added", function(snap) {
                var email = snap.val().email;
                if($('#tAssignee option:contains("' + email + '")').length <= 0) {
                    $('#tAssignee').append(
                        $('<option>', {"value" : snap.val().email, "text" : snap.val().email})
                    );
                }
            });
            //form.find('span')[0].innerText = user.password.email;
        };

        //prepare conatct object's HTML
        function contactHtmlFromObject(contact){
          console.log( contact );
          var html = '';
          html += '<li class="list-group-item contact">';
              html += '<p class="lead">'+ contact.email+'</p>';
          html += '</li>';
          return html;
        }

        /// Routing
        ////////////////////////////////////////

        // Handle transitions between routes
        function transitionRoute(path) {
            // grab the config object to get the form element and controller
            var formRoute = routeMap[path];
            var currentUser = rootRef.getAuth();

            // if authentication is required and there is no
            // current user then go to the register page and
            // stop executing
            if (formRoute.authRequired && !currentUser) {
                routeTo('register');
                return;
            }

            // wrap the upcoming form in jQuery
            var upcomingForm = $('#' + formRoute.form);

            // if there is no active form then make the current one active
            if (!activeForm) {
                activeForm = upcomingForm;
            }

            // hide old form and show new form
            activeForm.hide();
            upcomingForm.show().hide().fadeIn(750);

            // remove any listeners on the soon to be switched form
            activeForm.off();

            // set the new form as the active form
            activeForm = upcomingForm;

            // invoke the controller
            controllers[formRoute.controller](activeForm);
        }

        // Set up the transitioning of the route
        function prepRoute() {
            transitionRoute(this.path);
        }


        /// Routes
        ///  #/         - Login
        //   #/logout   - Logut
        //   #/register - Register
        //   #/profile  - Profile

        Path.map("#/").to(prepRoute);
        Path.map("#/logout").to(prepRoute);
        Path.map("#/register").to(prepRoute);
        Path.map("#/createUser").to(prepRoute);
        Path.map("#/profile").to(prepRoute);
        Path.map("#/task").to(prepRoute);

        Path.root("#/");

        /// Initialize
        ////////////////////////////////////////

        $(function () {

            // Start the router
            Path.listen();

            // whenever authentication happens send a popup
            rootRef.onAuth(function globalOnAuth(authData) {

                if (authData) {
                    showAlert({
                        title: 'Logged in!',
                        detail: 'Using ' + authData.provider,
                        className: 'alert-success'
                    });
                } else {
                    showAlert({
                        title: 'You are not logged in',
                        detail: '',
                        className: 'alert-info'
                    });
                }

            });

        });

    }(window.jQuery, window.Firebase, window.Path));
};
function log(email, action, data) {
    var actionItemRef = actionLogsRef.child("items").child(new Date().getTime());
    actionItemRef.set({
        'user': email,
        'action': action,
        'data': JSON.stringify(data),
        'time': new Date().getTime()
    });
    notifyMe(email, action);
}
// request permission on page load
document.addEventListener('DOMContentLoaded', function () {
    if (Notification.permission !== "granted")
        Notification.requestPermission();
});

function notifyMe(email, action) {
    if (!Notification) {
        alert('Desktop notifications not available in your browser. Try Chromium.');
        return;
    }

    if (Notification.permission !== "granted")
        Notification.requestPermission();
    else {
        var notification = new Notification('Notification', {
            icon: 'img/notif.png',
            body: "User: " + email + "\nhas just do action: " + action,
        });

        notification.onclick = function () {
            //window.open("http://stackoverflow.com/a/13328397/1269037");
        };

    }

}