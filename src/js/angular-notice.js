(function () {
    'use strict';

    var scripts = document.getElementsByTagName("script");
    var currentScriptPath = scripts[scripts.length - 1].src;
    var basePath = currentScriptPath.substring(0, currentScriptPath.lastIndexOf('/') + 1) + '..';

    var m = angular.module('notice', ['ngDialog', 'angular-loading-bar', 'session']);

    m.config(['ngDialogProvider', function (ngDialogProvider) {
        ngDialogProvider.setDefaults({className: 'ngdialog-theme-plain'});
    }]);

    m.provider('$notice', function () {
        var defaults = {pNotify: (typeof(PNotify) !== 'undefined'), confirm: 'dialog'};

        this.defaults = function (theDefaults) {
            defaults = theDefaults;
        };

        this.$get = ['$q', '$http', '$timeout', 'ngDialog', '$window', '$rootScope', '$session', function ($q, $http, $timeout, $dialog, $window, $rootScope, $session) {
            var serviceInstance = {};

            serviceInstance.show = function (obj) {
                if (obj && (obj.text || obj.title)) {
                    if (defaults.pNotify) {
                        new PNotify(obj);
                    } else {
                        alert(obj.text || obj.title);
                    }
                }
            };

            serviceInstance.confirm = function (msg, onSuccess, onCancel) {
                return serviceInstance.confirm2(msg, onSuccess, onCancel, false, 'Confirmation', 'Confirm', 'Cancel');
            };

            serviceInstance.confirm2 = function (msg, onSuccess, onCancel, neverShowId, title, yesLabel, noLabel) {
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
                            template: '<div class="dialog-contents"><h3 class="title">' + title + '</h3><p>' + msg + '</p>' +
                            (neverShowId ? '<p class="text-small"><label class="text-muted"><input type="checkbox" ng-model="neverShow"> Never show this message again</label></p>' : '' ) +
                            '<br/><p align="right"><button class="btn btn-default" ng-click="no()">' + noLabel + '</button> ' +
                            '<button ng-click="yes()" class="btn btn-primary"><b>' + yesLabel + '</b></button></p></div>',
                            controller: ['$scope', function ($scope) {
                                $scope.no = function () {
                                    deferred.reject();
                                    $scope.done(1);
                                };

                                $scope.yes = function () {
                                    deferred.resolve();
                                    $scope.done(2);
                                };

                                $scope.done = function (v) {
                                    if ($scope.neverShow) {
                                        $session.cookie("confirm_" + neverShowId, v, 365);
                                    }

                                    $scope.closeThisDialog();
                                };
                            }]
                        });
                    } else {
                        deferred.resolve();
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

            serviceInstance.success = function (msg, sticky) {
                return serviceInstance.show({text: msg, title: false, type: 'success', hide: !sticky});
            };

            serviceInstance.error = function (msg, sticky) {
                return serviceInstance.show({text: msg, title: false, type: 'error', hide: !sticky});
            };

            serviceInstance.info = function (msg, sticky) {
                return serviceInstance.show({text: msg, title: false, type: 'info', hide: !sticky});
            };

            serviceInstance.attach = function (id, msg, type, sticky, waitForElement) {
                var ele = angular.element(id);

                if (ele.length) {
                    return serviceInstance.show({text: msg, title: false, type: type || 'notice', hide: !sticky, stack: {"dir1": "down", "dir2": "left", "context": ele}});
                } else if (waitForElement || (typeof(waitForElement) === 'undefined')) {
                    setTimeout(serviceInstance.attach, 100, id, msg, type, sticky, waitForElement);
                }
            };

            serviceInstance.promise = function (msg, type, sticky) {
                return function () {
                    serviceInstance.show({text: msg, title: false, type: type || 'info', hide: !sticky});
                };
            };

            serviceInstance.prompt = function (prompt, title, msg, value) {
                return $dialog.openConfirm({
                    template: basePath + '/html/prompt.html',
                    controller: ['$scope', function ($scope) {
                        angular.extend($scope, {prompt: prompt, title: title, msg: msg, value: value});
                        setTimeout(function () {document.getElementById('promptValue').focus();}, 750);
                    }]
                });
            };

            return serviceInstance;
        }];
    });

    return m;
})();