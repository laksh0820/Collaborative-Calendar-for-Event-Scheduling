// Global object to track modal resources
const calendarResources = {
  modalListeners: [],
  timeouts: [],
  intervals: [],
  tooltips: []
};

// Helper functions
function getInitials(name) {
  if (!name) return '';
  const parts = name.split(' ');
  return parts.map(part => part[0].toUpperCase()).join('').substring(0, 2);
}

// To get the Avatar Color 
function getAvatarColor(name) {
  if (!name) return '#6c757d';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
    '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
    '#9c755f', '#bab0ac'
  ];
  return colors[Math.abs(hash) % colors.length];
}

// Function to cleanup the calendar Resources
function cleanupResources() {
  // Remove all event listeners
  calendarResources.modalListeners.forEach(({ element, event, handler }) => {
    if (element instanceof jQuery) {
      element.off(event, handler);
    } else if (element instanceof Element) {
      element.removeEventListener(event, handler);
    }
  });
  calendarResources.modalListeners = [];

  // Clear all timeouts and intervals
  calendarResources.timeouts.forEach(timeout => clearTimeout(timeout));
  calendarResources.timeouts = [];
  calendarResources.intervals.forEach(interval => clearInterval(interval));
  calendarResources.intervals = [];

  // Destroy all tooltips
  calendarResources.tooltips.forEach(tooltip => tooltip.dispose());
  calendarResources.tooltips = [];
}

// Function to show Flash Messages
function showFlashMessage(type, message) {
  // To Remove all the existing Flash Messages
  const existingDivs = document.querySelectorAll('.alert');
  existingDivs.forEach(div => div.remove());

  // Change the flash icon based on the flash message
  const icon = type === 'success' ?
    '<i class="bx bx-check-circle" style="color:lawngreen;"></i>' :
    '<i class="bx bx-error-circle" style="color:red;"></i>';

  // Display the flash message
  const flashHTML = `
    <div class="alert alert-dismissible fade show" role="alert"
        style="background-color:white; color:black; padding:10px; margin-right:5px;" id="flash-message">
        ${icon} ${message}
    </div>`;
  document.body.insertAdjacentHTML('beforeend', flashHTML);

  // Add Timeout to flash messages
  const flashElement = document.getElementById('flash-message');
  const timeoutId = setTimeout(() => {
    flashElement.style.opacity = '0';
    setTimeout(() => flashElement.remove(), 2000);
  }, 3000);
  calendarResources.timeouts.push(timeoutId);
}

// Function to load the calendat
function load_calendar() {
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
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
      if (info.event.extendedProps.description) {
        const tooltip = new bootstrap.Tooltip(info.el, {
          title: info.event.extendedProps.description,
          placement: 'top',
          trigger: 'hover'
        });
        calendarResources.tooltips.push(tooltip);
      }
    },
    events: function (fetchInfo, successCallback, failureCallback) {
      const group_id = document.getElementById('group-select').value;
      fetch(`/data/${group_id}`)
        .then(response => response.json())
        .then(data => successCallback(data))
        .catch(error => failureCallback(error));
    },
    eventClick: function (info) {
      showEventModal(info);
    },
    eventTimeFormat: {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      meridiem: 'short'
    },
    selectable: true,
    nowIndicator: true,
    select: function (arg) {
      handleCalendarSelection(arg);
    },
    loading: function (bool) {
      $('#loading').toggle(bool);
    }
  });

  // To render the calendar
  calendar.render();

  // Group selection change handler
  document.getElementById('group-select').addEventListener('change', function () {
    calendar.removeAllEvents();
    calendar.refetchEvents();
  });

  // Event modal functions
  function showEventModal(info) {
    cleanupResources();

    const modal = new bootstrap.Modal('#modal-view-event');
    $('.event-title').text(info.event.title);
    $('.event-body').html(
      info.event.extendedProps?.description ||
      '<span class="no-description">No description</span>'
    );

    const group_id = document.getElementById('group-select').value;
    if (group_id != 1) {
      setupParticipantsSection(info, modal);
    } else {
      document.getElementById("participants-section").style.display = 'none';
    }

    setupEventActions(info, modal);

    info.jsEvent.preventDefault();
    modal.show();
  }

  function setupParticipantsSection(info, modal) {
    document.getElementById("participants-section").style.display = 'block';
    const participantsList = document.getElementById('participants-list');
    participantsList.innerHTML = '';

    const participants = info.event.extendedProps.participants || [];
    if (participants.length > 0) {
      participants.forEach(participant => {
        renderParticipant(info, participant, participants.length > 1);
      });
    } else {
      const noParticipants = document.createElement('p');
      noParticipants.textContent = 'No participants';
      noParticipants.className = 'text-muted';
      participantsList.appendChild(noParticipants);
    }

    // Participant select focus handler
    const selectFocusHandler = () => updateParticipantSelect(info);
    $('#updateParticipantSelect').off('focus').on('focus', selectFocusHandler);
    calendarResources.modalListeners.push({
      element: $('#updateParticipantSelect'),
      event: 'focus',
      handler: selectFocusHandler
    });

    // Add participant handler
    const addClickHandler = () => viewAddParticipant(info);
    const addBtn = document.getElementById('modal-view-add-participant');
    if (addBtn) {
      addBtn.addEventListener('click', addClickHandler);
      calendarResources.modalListeners.push({
        element: addBtn,
        event: 'click',
        handler: addClickHandler
      });
    }

    // Enter key handler
    const keypressHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        viewAddParticipant(info);
      }
    };
    const selectInput = document.getElementById('updateParticipantSelect');
    if (selectInput) {
      selectInput.addEventListener('keypress', keypressHandler);
      calendarResources.modalListeners.push({
        element: selectInput,
        event: 'keypress',
        handler: keypressHandler
      });
    }
  }

  function setupEventActions(info, modal) {
    const group_id = document.getElementById('group-select').value;
    const group_permission = document.getElementById(`group-select-option-${group_id}`).dataset.permission;

    if (group_permission === 'Viewer') {
      document.getElementById('removeEvent').style.display = 'none';
    } else {
      document.getElementById('removeEvent').style.display = 'block';
      const removeHandler = (e) => {
        e.preventDefault();
        removeEvent(info.event);
      };
      $('#removeEvent').on('click', removeHandler);
      calendarResources.modalListeners.push({
        element: $('#removeEvent'),
        event: 'click',
        handler: removeHandler
      });
    }

    const saveHandler = (e) => {
      e.preventDefault();
      saveViewEvent(info.event);
    };
    $('#saveViewEvent').on('click', saveHandler);
    calendarResources.modalListeners.push({
      element: $('#saveViewEvent'),
      event: 'click',
      handler: saveHandler
    });
  }

  function renderParticipant(info, participant, showRemoveButton) {
    const participantsList = document.getElementById('participants-list');
    const participantElement = document.createElement('div');
    participantElement.className = 'participant';
    participantElement.id = `participant-email-${participant.email}`;

    // Create avatar
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.backgroundColor = getAvatarColor(participant.name);
    avatar.textContent = getInitials(participant.name);
    participantElement.appendChild(avatar);

    // Create info container
    const infoContainer = document.createElement('div');
    infoContainer.className = 'participant-info';

    // Add name and email
    const nameElement = document.createElement('p');
    nameElement.className = 'name';
    nameElement.textContent = participant.name || '';
    infoContainer.appendChild(nameElement);

    const emailElement = document.createElement('p');
    emailElement.className = 'email';
    emailElement.textContent = participant.email;
    infoContainer.appendChild(emailElement);

    participantElement.appendChild(infoContainer);

    if (showRemoveButton) {
      const removeElement = document.createElement('button');
      removeElement.className = "modal-view-participant-remove-button";
      removeElement.textContent = "Remove";
      removeElement.id = `modal-view-participant-remove-button-${participant.email}`;
      participantElement.appendChild(removeElement);

      const removeHandler = () => viewRemoveParticipant(info, participant.email);
      removeElement.addEventListener('click', removeHandler);
      calendarResources.modalListeners.push({
        element: removeElement,
        event: 'click',
        handler: removeHandler
      });
    }

    participantsList.appendChild(participantElement);
  }

  function saveViewEvent(event) {
    const eventTitle = $('#model-view-title-editable').text().trim();
    // const eventStart = $('#eventStart').val().trim();
    // const eventEnd = $('#eventEnd').val().trim();
    const description = $('#model-view-description-editable').text().trim();

    $('.is-invalid').removeClass('is-invalid');
    $('.invalid-feedback').hide();

    let isValid = true;

    if (!eventTitle) {
      showError('model-view-title-editable', 'Event title is required');
      isValid = false;
    }

    // if (!eventStart) {
    //   showError('eventStart', 'Start time is required');
    //   isValid = false;
    // }

    // if (!eventEnd) {
    //   showError('eventEnd', 'End time is required');
    //   isValid = false;
    // } else if (eventStart && new Date(eventStart) >= new Date(eventEnd)) {
    //   showError('eventEnd', 'End time must be after start time');
    //   isValid = false;
    // }

    if (isValid) {
      $('#modal-view-event').modal('hide');

      $.ajax({
        url: `/update_event/${event.extendedProps.event_id}`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({
          title: eventTitle,
          // start: eventStart,
          // end: eventEnd,
          description: description
        }),
        success: function () {
          calendar.removeAllEvents();
          calendar.refetchEvents();
          showFlashMessage('success', 'Event Updated Successfully');
        },
        error: function () {
          showFlashMessage('error', 'Error updating event');
        }
      });
    }
  }

  function removeEvent(event) {
    $('#modal-view-event').modal('hide');

    $.ajax({
      url: `/remove_event/${event.extendedProps.event_id}`,
      type: 'DELETE',
      contentType: 'application/json',
      success: function () {
        event.remove();
        showFlashMessage('success', 'Event Removed Successfully');
      },
      error: function () {
        showFlashMessage('error', 'Error Removing event');
      }
    });
  }

  function handleCalendarSelection(arg) {
    const group_id = document.getElementById('group-select').value;
    const group_permission = document.getElementById(`group-select-option-${group_id}`).dataset.permission;

    if (group_permission !== 'Viewer') {
      prepareEventCreationModal(group_id, arg);
    } else {
      showFlashMessage('error', 'Only View Permission');
    }
  }

  function prepareEventCreationModal(group_id, arg) {
    cleanupResources();

    if (group_id == 1) {
      document.getElementById('participants').style.display = 'none';
    } else {
      document.getElementById('participants').style.display = 'block';
      showParticipants();
    }

    $('.is-invalid').removeClass('is-invalid');
    $('.invalid-feedback').hide();

    $('#eventStart').val(arg.startStr);
    $('#eventEnd').val(arg.endStr);

    // Save event handler
    const saveHandler = (e) => saveCalendarEvent(e, calendar);
    $('#saveEvent').off('click').on('click', saveHandler);
    calendarResources.modalListeners.push({
      element: $('#saveEvent'),
      event: 'click',
      handler: saveHandler
    });

    $('#modal-view-event-add').modal('show');
  }

  function saveCalendarEvent(e, calendar) {
    e.preventDefault();

    const eventTitle = $('#eventTitle').val().trim();
    const eventStart = $('#eventStart').val().trim();
    const eventEnd = $('#eventEnd').val().trim();
    const description = $('#eventDescription').val().trim();
    const userGroup = $('#group-select').val();
    const participants = getSelectedParticipants();

    $('.is-invalid').removeClass('is-invalid');
    $('.invalid-feedback').hide();

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

    if (isValid) {
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
        success: function () {
          calendar.removeAllEvents();
          calendar.refetchEvents();
          showFlashMessage('success', 'Event Added Successfully');
        },
        error: function () {
          showFlashMessage('error', 'Error adding event');
        }
      });
    }
  }

  // Participant management functions
  function updateParticipantSelect(info) {
    const group_id = document.getElementById('group-select').value;
    $.ajax({
      url: `/members/${group_id}`,
      type: 'GET',
      success: function (data) {
        const select = $('#updateParticipantSelect');
        select.empty().append('<option value="" disabled selected>Select a participant</option>');

        const filteredData = data.filter(item1 =>
          !info.event.extendedProps.participants.some(item2 => item1.email === item2.email)
        );

        filteredData.forEach(member => {
          select.append(
            $('<option></option>')
              .val(member.email)
              .text(member.email)
          );
        });
      },
      error: function () {
        $('#updateParticipantSelect').html('<option value="" disabled>Error loading participants</option>');
      }
    });
  }

  function viewAddParticipant(info) {
    const input = document.getElementById('updateParticipantSelect');
    const email = input.value.trim();

    if (email) {
      $.ajax({
        url: `/update_participate/${info.event.extendedProps.event_id}/${email}`,
        type: 'PUT',
        contentType: 'application/json',
        success: function (data) {
          const optionToRemove = input.querySelector(`option[value="${email}"]`);
          if (optionToRemove) optionToRemove.remove();

          const participants = info.event.extendedProps.participants || [];
          if (participants.length == 1) {
            participants.forEach(p => {
              const participantElement = document.getElementById(`participant-email-${p.email}`);
              const removeElement = document.createElement('button');
              removeElement.className = "modal-view-participant-remove-button";
              removeElement.textContent = "Remove";
              removeElement.id = `modal-view-participant-remove-button-${p.email}`;
              participantElement.appendChild(removeElement);

              const removeHandler = () => viewRemoveParticipant(info, p.email);
              removeElement.addEventListener('click', removeHandler);
              calendarResources.modalListeners.push({
                element: removeElement,
                event: 'click',
                handler: removeHandler
              });
            });
          }

          participants.push(data);
          info.event.setExtendedProp('participants', participants);
          renderParticipant(info, data, true);
          input.value = '';
        },
        error: function () {
          showFlashMessage('error', 'Error adding participant');
        }
      });
    }
  }

  function viewRemoveParticipant(info, email) {
    $.ajax({
      url: `/remove_participate/${info.event.extendedProps.event_id}/${email}`,
      type: 'DELETE',
      contentType: 'application/json',
      success: function () {
        document.getElementById(`participant-email-${email}`)?.remove();
        const participants = info.event.extendedProps.participants || [];
        const updatedParticipants = participants.filter(p => p.email !== email);
        info.event.setExtendedProp('participants', updatedParticipants);

        if (updatedParticipants.length == 1) {
          updatedParticipants.forEach(p => {
            document.getElementById(`modal-view-participant-remove-button-${p.email}`)?.remove();
          });
        }
      },
      error: function () {
        showFlashMessage('error', 'Error removing participant');
      }
    });
  }

  function showParticipants() {
    const container = document.getElementById('eventParticipantsList');
    container.innerHTML = '';

    const userEmail = document.querySelector('meta[name="user-email"]').content;
    const currentUser = document.createElement('span');
    currentUser.className = 'badge d-flex align-items-center';
    currentUser.style = 'background:rgb(30, 18, 82);';
    currentUser.innerHTML = userEmail;
    container.appendChild(currentUser);

    const addHandler = () => addParticipant();
    $('#addParticipantBtn').off('click').on('click', addHandler);
    calendarResources.modalListeners.push({
      element: $('#addParticipantBtn'),
      event: 'click',
      handler: addHandler
    });

    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addParticipant();
      }
    };
    const selectInput = document.getElementById('participantSelect');
    if (selectInput) {
      selectInput.addEventListener('keypress', keyHandler);
      calendarResources.modalListeners.push({
        element: selectInput,
        event: 'keypress',
        handler: keyHandler
      });
    }
  }

  // Helper functions
  function getSelectedParticipants() {
    const badges = document.querySelectorAll('#eventParticipantsList .badge');
    return Array.from(badges).map(badge => ({
      name: badge.childNodes[0].textContent.trim()
    }));
  }

  function showError(fieldId, message) {
    $(`#${fieldId}`).addClass('is-invalid');
    $(`#${fieldId}`).next('.invalid-feedback').text(message).show();
  }
}

// Initialize calendar when DOM is loaded
document.addEventListener('DOMContentLoaded', load_calendar);

// Load members for participant selection
$(document).ready(function () {
  const loadHandler = () => loadMembers();
  $('#participantSelect').off('focus').on('focus', loadHandler);
  loadMembers();

  function loadMembers() {
    const group_id = document.getElementById('group-select').value;
    $.ajax({
      url: `/members/${group_id}`,
      type: 'GET',
      success: function (data) {
        const select = $('#participantSelect');
        select.empty().append('<option value="" disabled selected>Select a participant</option>');

        const userEmail = document.querySelector('meta[name="user-email"]').content;

        data.forEach(member => {
          if (member.email != userEmail) {
            select.append(
              $('<option></option>')
                .val(member.email)
                .text(member.email)
            );
          }
        });
      },
      error: function () {
        $('#participantSelect').html('<option value="" disabled>Error loading participants</option>');
      }
    });
  }
});