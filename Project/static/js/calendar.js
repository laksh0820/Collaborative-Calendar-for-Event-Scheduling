function load_calendar() {
  // Helper function to get initials from name
  function getInitials(name) {
    if (!name) return '';
    const parts = name.split(' ');
    return parts.map(part => part[0].toUpperCase()).join('').substring(0, 2);
  }

  // Helper function to generate consistent color from name
  function getAvatarColor(name) {
    if (!name) return '#6c757d'; // Default gray if no name

    // Simple hash function to generate consistent color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Predefined set of pleasant colors
    const colors = [
      '#4e79a7', // blue
      '#f28e2b', // orange
      '#e15759', // red
      '#76b7b2', // teal
      '#59a14f', // green
      '#edc948', // yellow
      '#b07aa1', // purple
      '#ff9da7', // pink
      '#9c755f', // brown
      '#bab0ac'  // gray
    ];

    return colors[Math.abs(hash) % colors.length];
  }

  var calendarEl = document.getElementById('calendar');
  var calendar = new FullCalendar.Calendar(calendarEl, {
    timeZone: 'local',
    themeSystem: 'bootstrap5',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
    },
    buttonText: {
      today: 'Today',
      month: 'Month',
      week: 'Week',
      day: 'Day',
      list: 'List'
    },
    weekNumbers: true,
    dayMaxEvents: true,
    eventDidMount: function (info) {
      // Add tooltip if description exists
      if (info.event.extendedProps.description) {
        new bootstrap.Tooltip(info.el, {
          title: info.event.extendedProps.description,
          placement: 'top',
          trigger: 'hover'
        });
      }
    },
    events: function (fetchInfo, successCallback, failureCallback) {
      var group_id = document.getElementById('group-select').value;
      fetch(`/data/${group_id}`)
        .then(response => response.json())
        .then(data => successCallback(data))
        .catch(error => failureCallback(error));
    }, // Fetch events from server
    eventClick: function (info) {
      // Close any currently open Bootstrap modal
      $('.modal').modal('hide');

      // Close the currently open popover
      $('.fc-more-popover').remove();

      // Close the currently open tooltip
      $('.tooltip').remove();

      // Modal approach
      const modal = new bootstrap.Modal('#modal-view-event');
      $('.event-title').html(info.event.title);
      // $('.event-start').html(info.event.start.toISOString().replace('T',' ').substring(0,16));
      // $('.event-end').html(info.event.end.toISOString().replace('T',' ').substring(0,16));
      $('.event-body').html(
        info.event.extendedProps?.description ||
        '<span class="no-description">No description</span>'
      );

      var group_id = document.getElementById('group-select').value;
      if (group_id != 1) {
        // Add the participation section
        document.getElementById("participants-section").style.display = 'block';

        // Handle participants
        const participants = info.event.extendedProps.participants;
        const participantsList = document.getElementById('participants-list');

        // Clear previous participants
        participantsList.innerHTML = '';

        // Check if there are participants
        if (participants && participants.length > 0) {
          // Create badges for each participant
          participants.forEach(participant => {
            // Create the participant container
            const participantElement = document.createElement('div');
            participantElement.className = 'participant';

            // Create avatar element with colored background
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.style.backgroundColor = getAvatarColor(participant.name); // Function to generate color
            avatar.textContent = getInitials(participant.name); // Function to get initials
            participantElement.appendChild(avatar);

            // Create participant info container
            const infoContainer = document.createElement('div');
            infoContainer.className = 'participant-info';

            // Create name element
            const nameElement = document.createElement('p');
            nameElement.className = 'name';
            nameElement.textContent = participant.name || '';
            infoContainer.appendChild(nameElement);

            // Create email element
            const emailElement = document.createElement('p');
            emailElement.className = 'email';
            emailElement.textContent = participant.email;
            infoContainer.appendChild(emailElement);

            // Add info container to participant element
            participantElement.appendChild(infoContainer);

            // Add participant to the list
            participantsList.appendChild(participantElement);
          });
        } else {
          // Show message if no participants
          const noParticipants = document.createElement('p');
          noParticipants.textContent = 'No participants';
          noParticipants.className = 'text-muted';
          participantsList.appendChild(noParticipants);
        }
      }
      else {
        // Hide the participants section for individual events
        document.getElementById("participants-section").style.display = 'none';
      }

      var group_permission = document.getElementById(`group-select-option-${group_id}`).dataset.permission;

      if (group_permission == 'Viewer') {
        document.getElementById('removeEvent').style.display = 'none';
      }
      else {
        // Add delete handler
        $('#removeEvent').on('click', function (e) {
          e.preventDefault();
          removeEvent(info.event);
        });
      }

      info.jsEvent.preventDefault();
      modal.show();
    },
    eventTimeFormat: { // Format the time display
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      meridiem: 'short'
    },
    selectable: true, // Enable date/time selection
    nowIndicator: true, // Show a line indicating the current time
    select: function (arg) {
      var group_id = document.getElementById('group-select').value;
      var group_permission = document.getElementById(`group-select-option-${group_id}`).dataset.permission;

      if (group_permission != 'Viewer') {

        if (group_id == 1) {
          // Individual Dashboard
          document.getElementById('participants').style.display = 'none';
        }
        else {
          // Group Dashboard
          document.getElementById('participants').style.display = 'block';
          showParticipants();
        }

        // Reset previous error states
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').hide();

        // Open the modal when a time range is selected
        $('#modal-view-event-add').modal('show');

        // Set the start and end times in the form
        $('#eventStart').val(arg.startStr);
        $('#eventEnd').val(arg.endStr);
      }
      else {
        // Remove any existing div with the class
        const existingDivs = document.querySelectorAll('.alert');
        existingDivs.forEach(div => div.remove());

        // Display the error flash message
        const flashHTML = `
        <div class="alert alert-dismissible fade show" role="alert"
            style="background-color:white; color:black; padding:10px; margin-right:5px;" id="add-event-error">
            <i class="bx bx-error" style="color:yellow;"></i>
            Only View Permission
        </div>`;
        const flashElement = document.body.insertAdjacentHTML('beforeend', flashHTML);

        // Auto-remove
        setTimeout(function () {
          const flashElement = document.getElementById('add-event-error');
          flashElement.style.opacity = '0';
          setTimeout(function () {
            flashElement.remove();
          }, 2000);
        }, 1000);
      }
    },
    loading: function (bool) {
      $('#loading').toggle(bool);
    }
  });

  calendar.render();

  // Add event listener to the dropdown
  document.getElementById('group-select').addEventListener('change', function () {
    // Remove all events at once
    calendar.removeAllEvents();

    // Refetch events when selection changes
    calendar.refetchEvents();
  });

  function showParticipants() {
    const container = document.getElementById('eventParticipantsList');
    container.innerHTML = '';

    const userEmail = document.querySelector('meta[name="user-email"]').content;
    const currentUser = document.createElement('span');
    currentUser.className = 'badge d-flex align-items-center';
    currentUser.style = 'background:rgb(30, 18, 82);'
    currentUser.innerHTML = `${userEmail}`;
    container.appendChild(currentUser);

    // Add participants for events functionality
    const participants = [];

    document.getElementById('addParticipantBtn')?.addEventListener('click', addParticipant);
    document.getElementById('participantSelect')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addParticipant();
      }
    });

    function addParticipant() {
      const input = document.getElementById('participantSelect');
      const name = input.value.trim();

      if (name && !participants.includes(name)) {
        participants.push(name);
        renderParticipantsList();
        input.value = '';
        input.focus();
      }
    }

    function removeParticipant(name) {
      const index = participants.indexOf(name);
      if (index !== -1) {
        participants.splice(index, 1);
        renderParticipantsList();
      }
    }

    function renderParticipantsList() {
      const container = document.getElementById('eventParticipantsList');
      container.innerHTML = '';

      const userEmail = document.querySelector('meta[name="user-email"]').content;
      const currentUser = document.createElement('span');
      currentUser.className = 'badge d-flex align-items-center';
      currentUser.style = 'background:rgb(30, 18, 82);'
      currentUser.innerHTML = `${userEmail}`;
      container.appendChild(currentUser);

      participants.forEach(name => {
        const badge = document.createElement('span');
        badge.className = 'badge d-flex align-items-center';
        badge.style = 'background:rgb(30, 18, 82);'
        badge.innerHTML = `
                ${name}
                <button type="button" class="btn-close btn-close-white ms-2" aria-label="Remove" data-name="${name}"></button>
            `;
        container.appendChild(badge);

        // Add event listener to remove button
        badge.querySelector('button').addEventListener('click', () => removeParticipant(name));
      });
    }
  }

  function getSelectedParticipants() {
    // Get all participant badge elements
    const badges = document.querySelectorAll('#eventParticipantsList .badge');

    // Convert NodeList to array and map to participant objects
    return Array.from(badges).map(badge => {
      // Extract the name (original text content minus the remove button)
      const name = badge.childNodes[0].textContent.trim();
      return {
        name: name
      };
    });
  }

  function showError(fieldId, message) {
    $(`#${fieldId}`).addClass('is-invalid');
    $(`#${fieldId}`).next('.invalid-feedback').text(message).show();
  }

  // Save event handler
  $('#saveEvent').on('click', function (e) {
    e.preventDefault();

    // Get form values
    const eventTitle = $('#eventTitle').val().trim();
    const eventStart = $('#eventStart').val().trim();
    const eventEnd = $('#eventEnd').val().trim();
    const description = $('#eventDescription').val().trim();
    const userGroup = $('#group-select').val();
    const participants = getSelectedParticipants(); // Get array of participant IDs\

    // Reset previous error states
    $('.is-invalid').removeClass('is-invalid');
    $('.invalid-feedback').hide();

    // Validate fields
    let isValid = true;

    if (!eventTitle) {
      showError('eventTitle', 'Event title is required');
      isValid = false;
    }

    if (!eventStart) {
      showError('eventStart', 'Start time is required');
      isValid = false;
    }

    if (!eventEnd) {
      showError('eventEnd', 'End time is required');
      isValid = false;
    } else if (eventStart && new Date(eventStart) >= new Date(eventEnd)) {
      showError('eventEnd', 'End time must be after start time');
      isValid = false;
    }

    if (userGroup != 1 && participants.length === 0) {
      showError('eventParticipantsList', 'Please select at least one participant');
      isValid = false;
    }

    // If valid, submit via AJAX
    if (isValid) {
      // Close the modal
      $('#modal-view-event-add').modal('hide');

      $.ajax({
        url: '/add_event',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          title: eventTitle,
          start: eventStart,
          end: eventEnd,
          description: description,
          group_id: userGroup,
          participants: participants
        }),
        success: function (response) {
          // Remove all events at once
          calendar.removeAllEvents();

          // Refetch events when selection changes
          calendar.refetchEvents();

          // Remove any existing div with the class
          const existingDivs = document.querySelectorAll('.alert');
          existingDivs.forEach(div => div.remove());

          // Display the success flash message
          const flashHTML = `
          <div class="alert alert-dismissible fade show" role="alert"
              style="background-color:white; color:black; padding:10px; margin-right:5px;" id="event-sub-success">
              <i class="bx bx-check-circle" style="color:lawngreen;"></i>
              Event Added Successfully
          </div>`;
          document.body.insertAdjacentHTML('beforeend', flashHTML);

          // Auto-remove
          setTimeout(function () {
            const flashElement = document.getElementById('event-sub-success');
            flashElement.style.opacity = '0';
            setTimeout(function () {
              flashElement.remove();
            }, 2000);
          }, 1000);
        },
        error: function () {
          // Remove any existing div with the class
          const existingDivs = document.querySelectorAll('.alert');
          existingDivs.forEach(div => div.remove());

          // Display the error flash message
          const flashHTML = `
          <div class="alert alert-dismissible fade show" role="alert"
              style="background-color:white; color:black; padding:10px; margin-right:5px;" id="event-sub-error">
              <i class="bx bx-error-circle" style="color:red;"></i>
              Error adding event
          </div>`;
          const flashElement = document.body.insertAdjacentHTML('beforeend', flashHTML);

          // Auto-remove
          setTimeout(function () {
            const flashElement = document.getElementById('event-sub-error');
            flashElement.style.opacity = '0';
            setTimeout(function () {
              flashElement.remove();
            }, 2000);
          }, 1000);
        }
      });
    }
  });

  // Remove event handler
  function removeEvent(event) {
    // Remove from calendar
    event.remove();

    // Close the modal
    $('#modal-view-event').modal('hide');

    // Delete from the server
    $.ajax({
      url: `/remove_event/${event.extendedProps.event_id}`,
      type: 'DELETE',
      contentType: 'application/json',
      success: function () {
        // Display the success flash message
        const flashHTML = `
        <div class="alert alert-dismissible fade show" role="alert"
            style="background-color:white; color:black; padding:10px; margin-right:5px;" id="event-rem-success">
            <i class="bx bx-check-circle" style="color:lawngreen;"></i>
            Event Removed Successfully
        </div>`;
        document.body.insertAdjacentHTML('beforeend', flashHTML);

        // Auto-remove
        setTimeout(function () {
          const flashElement = document.getElementById('event-rem-success');
          flashElement.style.opacity = '0';
          setTimeout(function () {
            flashElement.remove();
          }, 2000);
        }, 1000);
      },
      error: function () {
        // Remove any existing div with the class
        const existingDivs = document.querySelectorAll('.alert');
        existingDivs.forEach(div => div.remove());

        // Display the error flash message
        const flashHTML = `
        <div class="alert alert-dismissible fade show" role="alert"
            style="background-color:white; color:black; padding:10px; margin-right:5px;" id="event-rem-error">
            <i class="bx bx-error-circle" style="color:red;"></i>
            Error Removing event
        </div>`;
        const flashElement = document.body.insertAdjacentHTML('beforeend', flashHTML);

        // Auto-remove
        setTimeout(function () {
          const flashElement = document.getElementById('event-rem-error');
          flashElement.style.opacity = '0';
          setTimeout(function () {
            flashElement.remove();
          }, 2000);
        }, 1000);
      }
    });
  };
};

document.addEventListener('DOMContentLoaded', load_calendar);

$(document).ready(function () {
  // Fetch members when dropdown is clicked or page loads
  $('#participantSelect').one('focus', loadMembers);

  // Or load immediately on page load
  loadMembers();

  function loadMembers() {
    var group_id = document.getElementById('group-select').value;
    $.ajax({
      url: `/members/${group_id}`,
      type: 'GET',
      success: function (data) {
        const select = $('#participantSelect');
        select.empty().append('<option value="" disabled selected>Select a participant</option>');

        $.each(data, function (index, member) {
          select.append(
            $('<option></option>')
              .val(member.email)
              .text(member.email)
          );
        });
      },
      error: function () {
        $('#participantSelect').html('<option value="" disabled>Error loading participants</option>');
      }
    });
  }
});

// View and modify group settings
document.querySelector('#group-settings').addEventListener('click', edit_group_settings);
function edit_group_settings() {
  // Reset previous error states
  $('.is-invalid').removeClass('is-invalid');
  $('.invalid-feedback').hide();

  // State management
  let originalData = {};
  let currentData = {};
  let members = [];
  let hasChanges = false;

  // Fetch group data
  let groupId = document.getElementById('group-select').value;
  if (groupId == 1) return;
  let isAdmin = false;
  $.ajax({
    url: `/group_info/${groupId}`,
    type: 'GET',
    success: function (groupData) {
      originalData = {
          name: groupData['name'],
          description: groupData['description'],
          members: groupData['members']
      };
      
      currentData = {...originalData};
      members = [...groupData.members];

      isAdmin = groupData['authorization'];

      createAndShowModal(isAdmin, groupId);
    },
    error: () => showFlash('Failed to fetch group data', 'error')
  });

  // Create modal HTML
  function createAndShowModal(isAdmin, groupId) {
    const existingModal = document.getElementById('modal-edit-group');
    if (existingModal) existingModal.remove();

    const modalHTML = `
      <div class="modal fade" id="modal-edit-group" tabindex="-1" aria-labelledby="editGroupModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-lg">
              <div class="modal-content">
                  <div class="modal-header">
                      <h5 class="modal-title" id="editGroupModalLabel">Group Settings</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body">
                      <form id="editGroupForm">
                          <div class="mb-3">
                              <label class="form-label text-body-secondary fw-bold">Group Name</label>
                              <div id="groupNameContainer" class="editable-field" style="min-height: 38px;">
                                  <span id="groupNameDisplay" class="editable-text"></span>
                                  <input type="text" class="form-control d-none" id="editGroupName" required>
                                  <div class="invalid-feedback"></div>
                              </div>
                              <div class="invalid-feedback"></div>
                          </div>
                          <div class="mb-3">
                              <label class="form-label text-body-secondary fw-bold">Description</label>
                              <div id="groupDescContainer" class="editable-field" style="min-height: 100px;">
                                  <span id="groupDescDisplay" class="editable-text"></span>
                                  <textarea class="form-control d-none" id="editGroupDescription"></textarea>
                              </div>
                          </div>
                          <div class="mb-3">
                              <label class="form-label text-body-secondary fw-bold">Members</label>
                              ${isAdmin ? `
                              <div class="input-group mb-2">
                                  <input type="text" class="form-control" id="editMemberInput" placeholder="Enter email">
                                  <button class="btn btn-secondary dropdown-toggle" type="button" id="editRoleDropdown" data-bs-toggle="dropdown">
                                      Editor
                                  </button>
                                  <ul class="dropdown-menu dropdown-menu-end">
                                      <li><a class="dropdown-item" data-role="Viewer">Viewer</a></li>
                                      <li><a class="dropdown-item" data-role="Editor">Editor</a></li>
                                      <li><a class="dropdown-item" data-role="Admin">Admin</a></li>
                                  </ul>
                                  <button class="btn btn-primary" type="button" id="addEditMemberBtn">
                                      Add<i class="bi bi-plus-lg"></i>
                                  </button>
                              </div>
                               <div id="editmember-invalid-feedback" class="invalid-feedback"></div>
                              ` : ''}
                              <div id="editMembersList" class="list-group"></div>
                          </div>
                      </form>
                  </div>
                  <div class="modal-footer">
                      ${isAdmin ? `
                      <button type="button" class="btn btn-danger me-auto" id="deleteGroupBtn">
                          <i class="bi bi-trash"></i> Delete Group
                      </button>
                      <button type="button" class="btn btn-primary" id="saveChangesBtn" disabled>
                          <i class="bi bi-save"></i> Save Changes
                      </button>
                      ` : ''}
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                  </div>
              </div>
          </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Initialize modal
    const modalEl = document.getElementById('modal-edit-group');
    const modal = new bootstrap.Modal(modalEl);

    // Populate initial data
    $('#groupNameDisplay').text(originalData.name);
    $('#groupDescDisplay').text(originalData.description);
    renderMembersList();
    
    // Show modal after data loads
    modal.show();

    // Initialize editable fields (for admins only)
    if (isAdmin) {
        // Group name editing
        $('#groupNameContainer').on('click', function() {
            if ($(this).hasClass('editing')) return;
            
            $(this).addClass('editing');
            $('#groupNameDisplay').addClass('d-none');
            $('#editGroupName')
                .removeClass('d-none')
                .val(currentData.name)
                .focus();
        });
        
        $('#editGroupName').on('blur', function() {
            const newName = $(this).val().trim();
            if (newName !== currentData.name) {
                currentData.name = newName;
                $('#groupNameDisplay').text(newName);
                checkForChanges();
            }
            $('#groupNameContainer').removeClass('editing');
            $('#groupNameDisplay').removeClass('d-none');
            $(this).addClass('d-none');
        });
        
        // Description editing
        $('#groupDescContainer').on('click', function() {
            if ($(this).hasClass('editing')) return;
            
            const containerHeight = $(this).height();
            $(this).addClass('editing');
            $('#groupDescDisplay').addClass('d-none');
            $('#editGroupDescription')
                .removeClass('d-none')
                .val(currentData.description)
                .css('height', containerHeight + 'px')
                .focus();
        });
        
        $('#editGroupDescription').on('blur', function() {
            const newDesc = $(this).val().trim();
            if (newDesc !== currentData.description) {
                currentData.description = newDesc;
                $('#groupDescDisplay').text(newDesc);
                checkForChanges();
            }
            $('#groupDescContainer').removeClass('editing');
            $('#groupDescDisplay').removeClass('d-none');
            $(this).addClass('d-none');
        });
        
        // Member management
        $('#addEditMemberBtn').click(addMember);
        $('#editMemberInput').keypress(function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            addMember();
          }
        });
        
        // Role dropdown
        $(document).on('click', '[data-role]', function() {
            $('#editRoleDropdown').text($(this).data('role'));
        });
        
        // Save changes
        $('#saveChangesBtn').click(() => saveChanges(groupId));
        
        // Delete group
        $('#deleteGroupBtn').click(() => {
            if (confirm('Are you sure you want to permanently delete this group?')) {
                $.ajax({
                    url: `/group_info/${groupId}`,
                    type: 'DELETE',
                    success: () => {
                        modal.hide();
                        showFlash('Group deleted successfully', 'success');
                        refreshGroupList();
                    },
                    error: () => showFlash('Failed to delete group', 'error')
                });
            }
        });
    }
  }
  
  function addMember() {
      if ($(`#editMemberInput`).hasClass('is-invalid')) {
        $(`#editMemberInput`).removeClass('is-invalid');
        $(`#editmember-invalid-feedback`).hide();
      }
      const email = $('#editMemberInput').val().trim();
      const role = $('#editRoleDropdown').text().trim();
      
      if (!validateEmail(email)) {
        $(`#editMemberInput`).addClass('is-invalid');
        $(`#editmember-invalid-feedback`).text('Please enter a valid email').show();
        return;
      }
      
      if (members.some(m => m.email === email)) {
        $(`#editMemberInput`).addClass('is-invalid');
        $(`#editmember-invalid-feedback`).text('Member already exists').show();
        return;
      }
      
      members.push({ email, role });
      $('#editMemberInput').val('');
      renderMembersList();
      checkForChanges();
  }
  
  function removeMember(email) {
      members = members.filter(m => m.email !== email);
      renderMembersList();
      checkForChanges();
  }
  
  function renderMembersList() {
      const $container = $('#editMembersList').empty();
      
      members.forEach(member => {
          const $item = $(`
              <div class="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                      <span class="fw-bold">${member.email}</span>
                      <span class="badge bg-secondary ms-2">${member.role}</span>
                  </div>
                  ${isAdmin ? `
                  <button class="btn btn-sm btn-outline-danger remove-member" data-email="${member.email}">
                      <i class="bx bx-x" style="font-size:1.5rem; font-weight:bold;"></i>
                  </button>
                  ` : ''}
              </div>
          `);
          
          $container.append($item);
      });
      
      // Add remove handler for new buttons
      $('.remove-member').click(function() {
          removeMember($(this).data('email'));
      });
  }
  
  function checkForChanges() {
      const nameChanged = currentData.name !== originalData.name;
      const descChanged = currentData.description !== originalData.description;
      const membersChanged = JSON.stringify(members) !== JSON.stringify(originalData.members);
      
      hasChanges = nameChanged || descChanged || membersChanged;
      $('#saveChangesBtn').prop('disabled', !hasChanges);
  }
  
  function saveChanges(groupId) {
      if (!hasChanges) return;
      
      $.ajax({
          url: `/group_info/${groupId}`,
          type: 'PUT',
          contentType: 'application/json',
          data: JSON.stringify({
              name: currentData.name,
              description: currentData.description,
              members: members
          }),
          success: () => {
              showFlash('Group updated successfully', 'success');
              originalData = {...currentData};
              originalData.members = [...members];
              checkForChanges();
              refreshGroupList();
          },
          error: () => showFlash('Failed to update group', 'error')
      });
  }
  
  // Helper functions
  function validateEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  function showFlash(message, type) {
    const icon = type === 'success' ? 'bx-check-circle' : 'bx-error';
    const color = type === 'success' ? 'lawngreen' : 'red';
    
    const flashHTML = `
    <div class="alert alert-dismissible fade show" role="alert"
        style="background-color:white; color:black; padding:10px; margin-right:5px;">
        <i class="bx ${icon}" style="color:${color};"></i>
        ${message}
    </div>`;
    const flashElement = document.body.insertAdjacentHTML('beforeend', flashHTML);

    setTimeout(function() {
        const element = document.querySelector('.alert');
        if (element) {
            element.style.opacity = '0';
            setTimeout(function() {
                element.remove();
            }, 2000);
        }
    }, 1000);
  }
  
  function refreshGroupList() {
    $.ajax({
        url: '/get_groups',
        type: 'GET',
        success: function(data) {
            const select = $('#group-select');
            select.empty().append('<option value="1" data-permission="Admin">Dashboard</option>');

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
        error: function() {
            $('#group-select').html('<option value="" disabled>Error loading groups</option>');
        }
    });
  }
}