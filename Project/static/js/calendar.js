function load_calendar() {
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
        info.event.extendedProps?.description || 'No description'
      );
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
    // Refetch events when selection changes
    calendar.refetchEvents();
  });

  function showParticipants() {

    // Add participants for events functionality
    const participants = [];

    document.getElementById('addParticipantBtn')?.addEventListener('click', addParticipant);
    document.getElementById('participantInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addParticipant();
      }
    });

    function addParticipant() {
      const input = document.getElementById('participantInput');
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
      const container = document.getElementById('participantsList');
      container.innerHTML = '';

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
    // Get all selected participant IDs
    const participants = [];

    $('#participantsList .badge').each(function () {
      participants.push($(this).data('name'));
    });

    return participants;
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
    const participants = getSelectedParticipants(); // Get array of participant IDs

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
      showError('participantsList', 'Please select at least one participant');
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
          calendar.addEvent({ // Add event to calendar
            title: eventTitle,
            start: eventStart,
            description: description,
            end: eventEnd,
          });

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
  $('#participantInput').one('focus', loadMembers);

  // Or load immediately on page load
  loadMembers();

  function loadMembers() {
    var group_id = document.getElementById('group-select').value;
    $.ajax({
      url: `/members/${group_id}`,
      type: 'GET',
      success: function (data) {
        const select = $('#participantInput');
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
        $('#participantInput').html('<option value="" disabled>Error loading participants</option>');
      }
    });
  }
});
