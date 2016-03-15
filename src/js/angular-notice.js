(function () {
    'use strict';

    var m = angular.module('notice', ['ngDialog', 'angular-loading-bar', 'session']);

    m.config(['ngDialogProvider', function (ngDialogProvider) {
        ngDialogProvider.setDefaults({className: 'ngdialog-theme-plain'});
    }]);

    m.provider('$notice', function () {
        var defaults = {pNotify: (typeof(PNotify) !== 'undefined'), confirm: 'dialog'};

        this.defaults = function (theDefaults) {
            defaults = theDefaults;
        };

        this.automaticNotices = function (setter) {
            defaults.automaticNotices = setter;
        };

        this.$get = ['$q', '$http', '$timeout', 'ngDialog', '$window', '$rootScope', '$session', '$sce', function ($q, $http, $timeout, $dialog, $window, $rootScope, $session, $sce) {
            var serviceInstance = {};

            serviceInstance.show = function (obj) {
                if (obj && (obj.text || obj.title)) {
                    if (defaults.pNotify) {
                        new PNotify(angular.extend({}, obj, {title_escape: !obj.html, text_escape: !obj.html}));
                    } else {
                        alert(obj.text || obj.title);
                    }
                }
            };

            serviceInstance.hideAll = function () {
                if (defaults.pNotify) {
                    PNotify.removeAll();
                }
            };

            serviceInstance.confirm = function (msg, onSuccess, onCancel) {
                return serviceInstance.confirm2(msg, onSuccess, onCancel, false, 'Confirmation', 'Confirm', 'Cancel');
            };

            serviceInstance.alert = function (msg, title) {
                var deferred = $q.defer();

                serviceInstance.confirm2(msg, null, null, null, title || null, 'OK', false)
                    .then(deferred.resolve, deferred.resolve);

                return deferred.promise;
            };

            serviceInstance.confirm2 = function (msg, onSuccess, onCancel, neverShowId, title, yesLabel, noLabel, yesIfIgnore) {
                var deferred = $q.defer();
                var promise = deferred.promise;

                if (defaults.confirm == 'pnotify' && (typeof(PNotify.prototype.modules.confirm) !== 'undefined')) {
                    var V = function (success) {
                        return function (notice) {
                            PNotify.removeAll();
                            success ? deferred.resolve() : deferred.reject();
                        };
                    };

                    new PNotify({
                        text: msg, title: false, type: 'notice', confirm: {
                            confirm: true,
                            buttons: [{text: "Cancel", click: V(false)}, {text: "Confirm", promptTrigger: true, click: V(true)}]
                        }
                    });
                } else if (defaults.confirm == 'dialog') {
                    if (!neverShowId || !$session.cookie("confirm_" + neverShowId)) {
                        $dialog.openConfirm({
                            plain: true,
                            template: '<div class="dialog-contents">' + (title ? '<h3 class="title">' + title + '</h3>' : '') + '<p>' + msg + '</p>' +
                            (neverShowId ? '<p class="text-small"><label class="text-muted"><input type="checkbox" ng-model="neverShow"> Never show this message again</label></p>' : '' ) +
                            '<br/><p align="right">' + (noLabel !== false ? '<button class="btn btn-default" ng-click="no()">' + noLabel + '</button> ' : '') +
                            '<button ng-click="yes()" class="btn btn-primary"><b>' + yesLabel + '</b></button></p></div>',
                            controller: ['$scope', function ($scope) {
                                $scope.no = function () {
                                    $scope.done(1);
                                    $scope.closeThisDialog();
                                };

                                $scope.yes = function () {
                                    $scope.done(2);
                                    $scope.confirm();
                                };

                                $scope.done = function (v) {
                                    if ($scope.neverShow) {
                                        $session.cookie("confirm_" + neverShowId, v, 365);
                                    }
                                };
                            }]
                        }).then(deferred.resolve, deferred.reject);
                    } else {
                        if ((typeof(yesIfIgnore) === 'undefined') || yesIfIgnore) {
                            deferred.resolve();
                        } else {
                            deferred.reject();
                        }
                    }
                } else {
                    confirm(msg) ? deferred.resolve() : deferred.reject();
                }

                var arg = function (f) {
                    return angular.isString(f) ? serviceInstance.promise(f) : (f || function () {});
                };

                promise.then(arg(onSuccess), arg(onCancel));

                return promise;
            };

            serviceInstance.success = function (msg, sticky, html) {
                return serviceInstance.show({text: msg, title: false, type: 'success', hide: !sticky, html: html});
            };

            serviceInstance.error = function (msg, sticky, html) {
                return serviceInstance.show({text: msg, title: false, type: 'error', hide: !sticky, html: html});
            };

            serviceInstance.info = function (msg, sticky, html) {
                return serviceInstance.show({text: msg, title: false, type: 'info', hide: !sticky, html: html});
            };

            serviceInstance.attach = function (id, msg, type, sticky, waitForElement, html) {
                var ele = angular.element(id);

                if (ele.length) {
                    return serviceInstance.show({text: msg, title: false, type: type || 'notice', hide: !sticky, html: html, stack: {"dir1": "down", "dir2": "left", "context": ele}});
                } else if (waitForElement || (typeof(waitForElement) === 'undefined')) {
                    setTimeout(serviceInstance.attach, 100, id, msg, type, sticky, waitForElement);
                }
            };

            serviceInstance.promise = function (msg, type, sticky, html) {
                return function () {
                    serviceInstance.show({text: msg, title: false, type: type || 'info', html: html, hide: !sticky});
                };
            };

            serviceInstance.prompt = function (prompt, title, msg, value, inputType, cancelLabel, okLabel, helpText, hideCancel) {
                return $dialog.openConfirm({
                    template: '/static/bower_components/angular-notice/src/html/prompt.html',
                    showClose: !hideCancel,
                    controller: ['$scope', function ($scope) {
                        angular.extend($scope, {
                            prompt: prompt,
                            title: title,
                            msg: msg,
                            value: value,
                            inputType: inputType,
                            cancelLabel: cancelLabel,
                            hideCancel: hideCancel,
                            okLabel: okLabel,
                            helpText: $sce.trustAsHtml(helpText)
                        });
                        setTimeout(function () {document.getElementById('promptValue').focus();}, 750);
                    }]
                });
            };

            serviceInstance.defaultSuccess = function () {
                return serviceInstance.success('Success');
            };

            serviceInstance.defaultError = function (obj) {
                var extra = obj && obj.data ? ( ': ' + (obj.data.extra || obj.data)) : '';
                return serviceInstance.error('Error' + extra);
            };

            if (defaults.automaticNotices === true) {
                var message, type;
                var getParameterByName = function (name) {
                    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
                    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
                };

                if (message = getParameterByName('pnotify_success')) {
                    type = 'success';
                } else if (message = getParameterByName('pnotify_error')) {
                    type = 'error';
                }

                if (message && type) {
                    var txt = $('<div>' + message + '</div>').text();
                    $timeout(function () {serviceInstance[type](txt)}, 1000);
                }
            }

            return serviceInstance;
        }];
    });

    return m;
})();