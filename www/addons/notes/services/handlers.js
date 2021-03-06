// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

angular.module('mm.addons.notes')

/**
 * Notes handlers factory.
 *
 * This factory holds the different handlers used for delegates.
 *
 * @module mm.addons.notes
 * @ngdoc service
 * @name $mmaNotesHandlers
 */
.factory('$mmaNotesHandlers', function($mmaNotes, $mmSite, $mmApp, $ionicModal, $mmUtil, $q, $mmaNotesSync,
            mmCoursesAccessMethods) {

    // We use "caches" to decrease network usage.
    var self = {},
        addNoteEnabledCache = {},
        coursesNavEnabledCache = {};

    /**
     * Clear add note cache.
     * If a courseId is specified, it will only delete the entry for that course.
     *
     * @module mm.addons.notes
     * @ngdoc method
     * @name $mmaNotesHandlers#clearAddNoteCache
     * @param  {Number} [courseId] Course ID.
     */
    self.clearAddNoteCache = function(courseId) {
        if (courseId) {
            delete addNoteEnabledCache[courseId];
        } else {
            addNoteEnabledCache = {};
        }
    };

    /**
     * Clear courses nav cache.
     *
     * @module mm.addons.notes
     * @ngdoc method
     * @name $mmaNotesHandlers#clearCoursesNavCache
     */
    self.clearCoursesNavCache = function() {
        coursesNavEnabledCache = {};
    };

    /**
     * Add a note handler.
     *
     * @module mm.addons.notes
     * @ngdoc method
     * @name $mmaNotesHandlers#addNote
     */
    self.addNote = function() {

        var self = {};

        /**
         * Check if handler is enabled.
         *
         * @return {Promise} Promise resolved with true if enabled, resolved with false or rejected otherwise.
         */
        self.isEnabled = function() {
            return $mmaNotes.isPluginAddNoteEnabled();
        };

        /**
         * Check if handler is enabled for this user in this context.
         *
         * @param {Object} user     User to check.
         * @param {Number} courseId Course ID.
         * @param  {Object} [navOptions] Course navigation options for current user. See $mmCourses#getUserNavigationOptions.
         * @param  {Object} [admOptions] Course admin options for current user. See $mmCourses#getUserAdministrationOptions.
         * @return {Promise}        Promise resolved with true if enabled, resolved with false otherwise.
         */
        self.isEnabledForUser = function(user, courseId, navOptions, admOptions) {
            // Active course required.
            if (!courseId || user.id == $mmSite.getUserId()) {
                return $q.when(false);
            }
            if (typeof addNoteEnabledCache[courseId] != 'undefined') {
                return addNoteEnabledCache[courseId];
            }
            return $mmaNotes.isPluginAddNoteEnabledForCourse(courseId).then(function(enabled) {
                addNoteEnabledCache[courseId] = enabled;
                return enabled;
            });
        };

        /**
         * Get the controller.
         *
         * @param {Object} user     User.
         * @param {Number} courseId Course ID.
         * @return {Object}         Controller.
         */
        self.getController = function(user, courseid) {

            /**
             * Add note handler controller.
             *
             * @module mm.addons.notes
             * @ngdoc controller
             * @name $mmaNotesHandlers#addNote:controller
             */
            return function($scope) {

                // Button title.
                $scope.title = 'mma.notes.addnewnote';
                $scope.class = 'mma-notes-add-handler';

                $ionicModal.fromTemplateUrl('addons/notes/templates/add.html', {
                    scope: $scope,
                    animation: 'slide-in-up'
                }).then(function(m) {
                    $scope.modal = m;
                });

                $scope.closeModal = function(){
                    $scope.modal.hide();
                };

                $scope.addNote = function(){

                    $mmApp.closeKeyboard();

                    var loadingModal = $mmUtil.showModalLoading('mm.core.sending', true);
                    // Freeze the add note button.
                    $scope.processing = true;

                    $mmaNotes.addNote(user.id, courseid, $scope.note.publishstate, $scope.note.text).then(function(sent) {
                        var message = sent ? 'mma.notes.eventnotecreated' : 'mm.core.datastoredoffline';
                        $mmUtil.showModal('mm.core.success', message);
                        $scope.closeModal();
                    }, function(error) {
                        $mmUtil.showErrorModal(error);
                        $scope.processing = false;
                    }).finally(function() {
                        loadingModal.dismiss();
                    });
                };

                $scope.action = function($event) {
                    $event.preventDefault();
                    $event.stopPropagation();

                    $scope.note = {
                        publishstate: 'personal',
                        text: ''
                    };
                    $scope.processing = false;

                    $scope.modal.show();

                };
            };

        };

        return self;
    };

    /**
     * Course nav handler.
     *
     * @module mm.addons.notes
     * @ngdoc method
     * @name $mmaNotesHandlers#coursesNav
     */
    self.coursesNav = function() {

        var self = {};

        /**
         * Check if handler is enabled.
         *
         * @return {Promise} Promise resolved with true if enabled, resolved with false or rejected otherwise.
         */
        self.isEnabled = function() {
            return $mmaNotes.isPluginViewNotesEnabled();
        };

        /**
         * Check if handler is enabled for this course.
         *
         * @param  {Number} courseId     Course ID.
         * @param  {Object} accessData   Type of access to the course: default, guest, ...
         * @param  {Object} [navOptions] Course navigation options for current user. See $mmCourses#getUserNavigationOptions.
         * @param  {Object} [admOptions] Course admin options for current user. See $mmCourses#getUserAdministrationOptions.
         * @return {Boolean}             True if handler is enabled, false otherwise.
         */
        self.isEnabledForCourse = function(courseId, accessData, navOptions, admOptions) {
            if (accessData && accessData.type == mmCoursesAccessMethods.guest) {
                return false; // Not enabled for guests.
            }

            if (navOptions && typeof navOptions.notes != 'undefined') {
                return navOptions.notes;
            }

            if (typeof coursesNavEnabledCache[courseId] != 'undefined') {
                return coursesNavEnabledCache[courseId];
            }
            return $mmaNotes.isPluginViewNotesEnabledForCourse(courseId).then(function(enabled) {
                coursesNavEnabledCache[courseId] = enabled;
                return enabled;
            });
        };

        /**
         * Get the controller.
         *
         * @param {Number} courseId Course ID.
         * @return {Object}         Controller.
         */
        self.getController = function(courseId) {

            /**
             * Courses nav handler controller.
             *
             * @module mm.addons.notes
             * @ngdoc controller
             * @name $mmaNotesHandlers#coursesNav:controller
             */
            return function($scope, $state) {
                $scope.icon = 'ion-ios-list';
                $scope.title = 'mma.notes.notes';
                $scope.class = 'mma-notes-view-handler';
                $scope.action = function($event, course) {
                    $event.preventDefault();
                    $event.stopPropagation();
                    $state.go('site.notes-types', {
                        course: course
                    });
                };
            };
        };

        return self;
    };

    /**
     * Synchronization handler.
     *
     * @module mm.addons.notes
     * @ngdoc method
     * @name $mmaNotesHandlers#syncHandler
     */
    self.syncHandler = function() {

        var self = {};

        /**
         * Execute the process.
         * Receives the ID of the site affected, undefined for all sites.
         *
         * @param  {String} [siteId] ID of the site affected, undefined for all sites.
         * @return {Promise}         Promise resolved when done, rejected if failure.
         */
        self.execute = function(siteId) {
            return $mmaNotesSync.syncAllNotes(siteId);
        };

        /**
         * Get the time between consecutive executions.
         *
         * @return {Number} Time between consecutive executions (in ms).
         */
        self.getInterval = function() {
            return 600000; // 10 minutes.
        };

        /**
         * Whether it's a synchronization process or not.
         *
         * @return {Boolean} True if is a sync process, false otherwise.
         */
        self.isSync = function() {
            return true;
        };

        /**
         * Whether the process uses network or not.
         *
         * @return {Boolean} True if uses network, false otherwise.
         */
        self.usesNetwork = function() {
            return true;
        };

        return self;
    };

    return self;
})

.run(function($mmaNotesHandlers, $mmEvents, mmCoreEventLogout, mmCoursesEventMyCoursesRefreshed, mmUserEventProfileRefreshed) {
    $mmEvents.on(mmCoreEventLogout, function() {
        $mmaNotesHandlers.clearAddNoteCache();
        $mmaNotesHandlers.clearCoursesNavCache();
    });
    $mmEvents.on(mmCoursesEventMyCoursesRefreshed, $mmaNotesHandlers.clearCoursesNavCache);
    $mmEvents.on(mmUserEventProfileRefreshed, function(data) {
        $mmaNotesHandlers.clearAddNoteCache(data.courseid);
    });
});
