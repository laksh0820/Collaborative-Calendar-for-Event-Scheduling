let btn = document.querySelector('#btn');
let sidebar = document.querySelector('.sidebar');
let searchBtn = document.querySelector('.bx-search');
let createGrp = document.querySelector('#create-group-link');
const notificationBtn = document.getElementById('notificationBtn');
const notificationPopover = document.getElementById('notificationPopover');
const notificationBadge = document.getElementById('notificationBadge');

// Fetch number of unread notifications on page load
document.addEventListener('DOMContentLoaded', function () {
    fetch_unread_notifications_count();
});

// Toggle notification popover
if (notificationBtn !== null) {
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (notificationPopover.classList.contains('d-none')) {
            // Remove d-none class to show the popover
            notificationPopover.classList.remove('d-none');

            // Use requestAnimationFrame to ensure the d-none removal is processed
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    notificationPopover.classList.add('show');
                    get_notifications(); // Fetch notifications when opening the popover
                });
            });
        }
        else {
            notificationPopover.classList.remove('show');
            // Wait for transition to complete before hiding
            setTimeout(() => {
                notificationPopover.classList.add('d-none');
            }, 300); // Match the transition duration
        }
    });

    // Disable text selection on double click with mousedown
    notificationBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
    }, false);
}


// Close notification popover when clicking outside
document.addEventListener('click', (e) => {
    if (notificationPopover !== null && !notificationPopover.contains(e.target) && e.target !== notificationBtn) {
        notificationPopover.classList.remove('show');
        setTimeout(() => {
            notificationPopover.classList.add('d-none');
        }, 300);
    }
});

btn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

searchBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

createGrp.addEventListener('click', create_group);

// Create group modal functionality
function create_group() {
    // Reset previous error states
    $('.is-invalid').removeClass('is-invalid');
    $('.invalid-feedback').hide();

    // Create modal HTML if it doesn't exist
    if (!document.getElementById('modal-create-group')) {
        const modalHTML = `
        <div class="modal fade" id="modal-create-group" tabindex="-1" aria-labelledby="createGroupModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="createGroupModalLabel">Create New Group</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="createGroupForm">
                            <div class="mb-3">
                                <label for="groupName" class="form-label text-body-secondary fw-bold">Group Name</label>
                                <input type="text" class="form-control" id="groupName" required>
                                <div class="invalid-feedback"></div>
                            </div>
                            <div class="mb-3">
                                <label for="groupDescription" class="form-label text-body-secondary fw-bold">Description</label>
                                <textarea class="form-control" id="groupDescription" rows="6" style="min-height: 100px; resize: vertical;"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-body-secondary fw-bold">Members</label>
                                <div class="input-group mb-2">
                                    <input type="text" class="form-control" id="memberInput" placeholder="Enter email">
                                    <button class="btn btn-secondary btn-sm dropdown-toggle" type="button" id="roleDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                                    Editor
                                    </button>
                                    <ul class="dropdown-menu" aria-labelledby="roleDropdown">
                                    <li><a class="dropdown-item" onclick="document.getElementById('roleDropdown').textContent = 'Viewer';">Viewer</a></li>
                                    <li><a class="dropdown-item" onclick="document.getElementById('roleDropdown').textContent = 'Editor';">Editor</a></li>
                                    <li><a class="dropdown-item" onclick="document.getElementById('roleDropdown').textContent = 'Admin';">Admin</a></li>
                                    </ul>
                                    <button class="btn btn-primary" type="button" id="addMemberBtn">
                                        Add<i class="bi bi-plus-lg"></i>
                                    </button>
                                </div>
                                <div id="member-invalid-feedback" class="invalid-feedback"></div>
                                <div id="membersList" class="d-flex flex-wrap gap-2"></div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="cancelGroupBtn" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="submitGroupBtn">Create Group</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add member functionality
        document.getElementById('addMemberBtn')?.addEventListener('click', function (e) {
            e.preventDefault();
            addMember();
        });
        document.getElementById('memberInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addMember();
            }
        });

        // Submit and Cancel button functionality
        document.getElementById('submitGroupBtn')?.addEventListener('click', submitGroup);
        document.getElementById('cancelGroupBtn')?.addEventListener('click', cancelGroup);
    }

    // Initialize modal
    const modalEl = document.getElementById('modal-create-group');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // Show modal
    modal.show();

    const members = [];
    const permissions = [];

    function addMember() {
        if ($(`#memberInput`).hasClass('is-invalid')) {
            $(`#memberInput`).removeClass('is-invalid');
            $(`#member-invalid-feedback`).hide();
        }

        const meminput = document.getElementById('memberInput');
        const email = meminput.value.trim();
        const perminput = document.getElementById('roleDropdown');
        const perm = perminput.textContent.trim();

        const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if (!emailRegex.test(email)) {
            $(`#memberInput`).addClass('is-invalid');
            $(`#member-invalid-feedback`).text('Please enter a valid email').show();
            return;
        }
        if (members.includes(email)) {
            $(`#memberInput`).addClass('is-invalid');
            $(`#member-invalid-feedback`).text('Member already exists').show();
            return;
        }
        if (email) {
            members.push(email);
            permissions.push(perm);
            renderMembersList();
            meminput.value = '';
            meminput.focus();
        }
    }

    function removeMember(email) {
        const index = members.indexOf(email);
        if (index !== -1) {
            members.splice(index, 1);
            permissions.splice(index, 1);
            renderMembersList();
        }
    }

    function renderMembersList() {
        const container = document.getElementById('membersList');
        container.innerHTML = '';

        members.forEach(email => {
            const badge = document.createElement('span');
            badge.className = 'badge d-flex align-items-center';
            badge.style = 'background:rgb(30, 18, 82);'
            badge.innerHTML = `
                ${email}
                <button type="button" class="btn-close btn-close-white ms-2" aria-label="Remove" data-name="${email}"></button>
            `;
            container.appendChild(badge);

            // Add event listener to remove button
            badge.querySelector('button').addEventListener('click', () => removeMember(email));
        });
    }

    function submitGroup() {
        const groupName = document.getElementById('groupName').value.trim();
        const description = document.getElementById('groupDescription').value.trim();

        if (!groupName) {
            $(`#groupName`).addClass('is-invalid');
            $(`#groupName`).next('.invalid-feedback').text('Please enter a group name').show();
            return;
        }

        // Send data to server
        $.ajax({
            url: '/create_group',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                name: groupName,
                description: description,
                members: members,
                permissions: permissions
            }),
            success: function (response) {
                // Update the group-select 
                $.ajax({
                    url: '/get_groups',
                    type: 'GET',
                    success: function (data) {
                        const select = $('#group-select');
                        select.empty().append('<option id="group-select-option-1" value="1" data-permission="Admin">Dashboard</option>');

                        $.each(data, function (index, group) {
                            select.append(
                                $('<option></option>')
                                    .attr('id', 'group-select-option-' + group.group_id)
                                    .val(group.group_id)
                                    .text(group.name)
                                    .attr('data-permission', group.permission)
                            );
                        });
                    },
                    error: function () {
                        $('#group-select').html('<option value="" disabled>Error loading groups</option>');
                    }
                });

                // Remove any existing div with the class
                const existingDivs = document.querySelectorAll('.alert');
                existingDivs.forEach(div => div.remove());

                // Display the success flash message
                const flashHTML = `
                <div class="alert alert-dismissible fade show" role="alert"
                    style="background-color:white; color:black; padding:10px; margin-right:5px; z-index: 2000;" id="group-sub-success">
                    <i class="bx bx-check-circle" style="color:lawngreen;"></i>
                    Successfully Created Group
                </div>`;
                const flashElement = document.body.insertAdjacentHTML('beforeend', flashHTML);

                // Auto-remove after  seconds
                setTimeout(function () {
                    const flashElement = document.getElementById('group-sub-success');
                    flashElement.style.opacity = '0';
                    setTimeout(function () {
                        flashElement.remove();
                    }, 2000);
                }, 1000);
            },
            error: function (response) {
                alert('Group Form Submission error');
            }
        });

        // Close the modal
        modal.hide();

        // Reset form
        document.getElementById('createGroupForm').reset();
        members.length = 0;
        permissions.length = 0;
        renderMembersList();
    }

    function cancelGroup() {
        // Reset form
        document.getElementById('createGroupForm').reset();
        members.length = 0;
        permissions.length = 0;
        renderMembersList();
    }
}

// Fetch unread notifications count
function fetch_unread_notifications_count() {
    // Check if the notification badge exists before trying to access it
    if (notificationBadge === null) return;

    $.ajax({
        url: '/get_notifications',
        type: 'GET',
        success: function (response) {
            const unreadCount = response.length;
            notificationBadge.textContent = unreadCount;
            if (unreadCount > 0) {
                // Show the badge if there are unread notifications
                if (notificationBadge.classList.contains('d-none')) {
                    notificationBadge.classList.remove('d-none');
                }
            } else {
                // Hide the badge if there are no unread notifications
                if (!notificationBadge.classList.contains('d-none')) {
                    notificationBadge.classList.add('d-none');
                }
            }
        },
        error: function () {
            console.error('Error fetching notifications count');
        }
    });
}

// Function to get notifications
function get_notifications() {
    $.ajax({
        url: '/get_notifications',
        type: 'GET',
        success: function (response) {
            // Process and display notifications
            const notificationsContainer = $('#notificationList');
            notificationsContainer.empty();

            // Update the number of unread notifications
            const unreadCount = response.length;
            if (unreadCount > 0) {
                notificationBadge.textContent = unreadCount;
                notificationBadge.classList.remove('d-none');
            } else {
                notificationBadge.classList.add('d-none');
            }

            // No notifications available
            if (response.length === 0) {
                notificationsContainer.html('<div class="text-center py-3"><p>No unread notifications</p></div>');
                return;
            }

            response.forEach((notification, index, array) => {
                // Check if this notification is the last one in the list
                if (index === array.length - 1) {
                    const notificationHTML = `
                    <div class="notification-item ${(notification.read_status === "Read") ? '' : 'unread'} last-notification" data-id="${notification.id}" data-type="${notification.type}">
                        <div class="p-3 notification-content">
                            <p class="mb-0">You have been invited to ${(notification.type === 'group') ? 'group ' : 'event '} ${notification.name}</p>
                        </div>
                        <div class="notification-footer p-2">${notification.passed_time}</div>
                    </div>`;
                    notificationsContainer.append(notificationHTML);
                }
                else {
                    const notificationHTML = `
                    <div class="notification-item ${(notification.read_status === "Read") ? '' : 'unread'}" data-id="${notification.id}" data-type="${notification.type}">
                        <div class="p-3 notification-content">
                            <p class="mb-0">You have been invited to ${(notification.type === 'group') ? 'group ' : 'event '} ${notification.name}</p>
                        </div>
                        <div class="notification-footer p-2">${notification.passed_time}</div>
                    </div>`;
                    notificationsContainer.append(notificationHTML);
                }
            });

            /* Setup click handlers for notifications */
            // Mark notifications as read when clicked
            const unread_notifications = document.querySelectorAll('.notification-item.unread');
            unread_notifications.forEach(notification => {
                notification.addEventListener('click', () => {
                    // Check if notification is already read
                    if (!notification.classList.contains('unread')) return;

                    const notification_id = notification.getAttribute('data-id');
                    const notification_type = notification.getAttribute('data-type');
                    console.log(notification_id, notification_type);

                    // Send a request to mark the notification as read
                    $.ajax({
                        url: '/get_notifications',
                        type: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            id: notification_id,
                            type: notification_type
                        }),
                        success: function () {
                            notification.classList.remove('unread');
                            updateNotificationCount(); // Update the notification count
                        },
                        error: function () {
                            console.error('Error marking notification as read');
                        }
                    });
                });
            });

            // Disable text selection on double click with mousedown
            unread_notifications.forEach(notification => {
                notification.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                }, false);
            });
        },
        error: function () {
            alert('Error loading notifications. Please try again later.');
        },
    });

    // Update notification badge count
    function updateNotificationCount() {
        const unreadCount = document.querySelectorAll('.notification-item.unread').length;
        const notificationBadge = document.getElementById('notificationBadge');

        // Check if the badge is hidden, then unhide it
        if (notificationBadge.classList.contains('d-none')) {
            notificationBadge.classList.remove('d-none');
        }
        // Update the badge count
        notificationBadge.textContent = unreadCount;
        if (unreadCount === 0) {
            notificationBadge.classList.add('d-none');
        }
    }
}