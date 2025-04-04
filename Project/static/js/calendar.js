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
          // Display the error flash message
          const flashHTML = `
          <div class="alert alert-danger alert-dismissible fade show" role="alert"
              style="color:black; padding:10px; margin-right:5px;" id="event-sub-error">
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
