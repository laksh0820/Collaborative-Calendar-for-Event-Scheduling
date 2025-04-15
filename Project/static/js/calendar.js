// Global object to track modal resources
const calendarResources = {
  modalListeners: [],
  tooltips: []
};

// Cache Manager
const calendarCache = {
  // Get cached data
  get: function (groupId) {
    const cacheKey = `calendar_events_${groupId}`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const { data, timestamp, ttl } = JSON.parse(cached);

    // Check if cache is expired (default 1 hour TTL)
    const now = new Date().getTime();
    if (now > timestamp + (ttl || 3600000)) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return { data, timestamp, ttl };
  },

  // Store data in cache
  set: function (groupId, data, ttl = 3600000) {
    const cacheKey = `calendar_events_${groupId}`;
    const cacheValue = {
      data,
      timestamp: new Date().getTime(),
      ttl
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheValue));
  },

  // Clear entire cache 
  clearAll: function () {
    Object.keys(localStorage).forEach(key => {
      localStorage.removeItem(key);
    });
  },

  // Clear specific cache entries
  clear: function (groupId) {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(`calendar_events_${groupId}`)) {
        localStorage.removeItem(key);
      }
    });
  },

  // Clear specific event from the cache entries
  clearEvent: function (groupId, eventId) {
    const cacheKey = `calendar_events_${groupId}`;
    const cached = localStorage.getItem(cacheKey);

    if (!cached) return; // No cache exists for this group

    try {
      const { data, timestamp, ttl } = JSON.parse(cached);

      // Filter out the event to be removed
      const updatedEvents = data.filter(event => event.event_id !== eventId);

      // Only update cache if something was actually removed
      if (updatedEvents.length !== data.length) {
        const newCacheValue = {
          data: updatedEvents,
          timestamp, // Keep original timestamp
          ttl       // Keep original TTL
        };
        localStorage.setItem(cacheKey, JSON.stringify(newCacheValue));
        return true; // Indicate success
      }
      return false; // No changes made
    } catch (e) {
      console.error('Error processing cache:', e);
      return false;
    }
  }
};

// For Clearing the cache when the user signout
document.getElementById('signout-navbar')?.addEventListener('click', function (e) {
  e.preventDefault();
  calendarCache.clearAll(); // clear only our app's cache
  window.location.href = this.href;  // proceed with signout after clearing the cache
});
document.getElementById('signout-sidebar')?.addEventListener('click', function (e) {
  e.preventDefault();
  calendarCache.clearAll(); // clear only our app's cache
  window.location.href = this.href;  // proceed with signout after clearing the cache
});

// For Check Invite
let checkInvt = document.querySelector('#check-invites-link');

// Helper functions
function getInitials(name) {
  if (!name) return '';
  const parts = name.split(' ').filter(part => part.length > 0);
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
function cleanupResources(arg) {
  if (arg === 'all' || arg === 'modal') {
    // Remove all event listeners
    calendarResources.modalListeners.forEach(({ element, event, handler }) => {
      if (element instanceof jQuery) {
        element.off(event, handler);
      } else if (element instanceof Element) {
        element.removeEventListener(event, handler);
      }
    });
    calendarResources.modalListeners = [];
  }

  // Destroy all tooltips
  if (arg === 'all' || arg === 'tooltip') {
    calendarResources.tooltips.forEach(tooltip => tooltip.dispose());
    calendarResources.tooltips = [];
  }
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
        style="background-color:white; color:black; padding:10px; margin-right:5px; z-index: 2000;" id="flash-message">
        ${icon} ${message}
    </div>`;
  document.body.insertAdjacentHTML('beforeend', flashHTML);

  // Add Timeout to flash messages
  const flashElements = document.querySelectorAll('#flash-message');
  setTimeout(() => {
    if (flashElements) {
      flashElements.forEach(flashElement => {
        flashElement.style.opacity = '0';
        setTimeout(() => flashElement.remove(), 2000);
      });
    }
  }, 1000);
}

// Function to load the calendar
function load_calendar() {
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    timeZone: 'UTC',
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
    eventTimeFormat: {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      meridiem: 'short'
    },
    selectable: true,
    nowIndicator: true,
    eventDidMount: function (info) {
      if (info.event.extendedProps.description) {
        // Create a tooltip for the event description
        let tooltip = bootstrap.Tooltip.getInstance(info.el);
        if (tooltip) {
          tooltip.dispose(); // Dispose of the existing tooltip instance
        }

        let desc = info.event.extendedProps.description;
        tooltip = new bootstrap.Tooltip(info.el, {
          title: desc.length > 200 ? desc.substring(0, 200) + '...' : desc,
          placement: 'top',
          trigger: 'hover',
          html: true,
          customClass: 'multiline-tooltip'
        });
        calendarResources.tooltips.push(tooltip);
      }

      if (info.event.extendedProps.is_pending_for_current_user) {
        info.el.style.opacity = '0.6';
      }
    },
    events: function (fetchInfo, successCallback, failureCallback) {
      const group_id = document.getElementById('group-select').value;

      // Try to get from cache first
      const cachedObj = calendarCache.get(group_id);
      if (cachedObj) {
        const cachedData = cachedObj.data;

        // 1. Prepare version map from cache
        const versionMap = cachedData.map(event => ({
          event_id: event.event_id,
          cache_number: event.cache_number
        }));

        // 2. Request only updated events
        fetch(`/data/${group_id}/updates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            events: versionMap
          })
        })
          .then(async (response) => {
            const updates = await response.json();
            if (!response.ok) {
              throw new Error(updates.error);
            }

            const newAndUpdatedEvents = updates.updated_events;
            const deletedEventIds = updates.deleted_events;

            // 3. Merge updates with cache

            // Delete the cached events that are not in the database anymore
            deletedEventIds.forEach(deleted_event_id => {
              calendarCache.clearEvent(group_id, deleted_event_id);
            });

            // Create a copy of cached data to modify
            let mergedData = [...cachedData];

            // Remove deleted events from the merged data
            mergedData = mergedData.filter(event =>
              !deletedEventIds.includes(event.event_id)
            );

            // Process updates
            newAndUpdatedEvents.forEach(update => {
              const existingIndex = mergedData.findIndex(e => e.event_id === update.event_id);

              if (existingIndex >= 0) {
                // Update existing event (preserve unchanged fields)
                mergedData[existingIndex] = {
                  ...mergedData[existingIndex],
                  ...update
                };
              } else {
                // Add new event
                mergedData.push(update);
              }
            });

            // 4. Update cache and callback
            calendarCache.set(group_id, mergedData, cachedObj.ttl);

            fetch_unread_notifications_count();   // Refresh the notification count
            fetch_pending_invites_count(); // Refresh the invite count

            successCallback(mergedData);
          })
          .catch(error => {
            showFlashMessage('error', error.message);
          });
        return;
      }

      fetch(`/data/${group_id}`)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error);
          }
          calendarCache.set(group_id, data);

          fetch_unread_notifications_count();   // Refresh the notification count
          fetch_pending_invites_count(); // Refresh the invite count

          successCallback(data);
        })
        .catch(error => {
          showFlashMessage('error', error.message);
          failureCallback(error);
        });
    },
    eventClick: function (info) {

      // Check if there exists an HTML element with class name 'fc-more-popover'
      const popover = document.getElementsByClassName('fc-more-popover');
      if (popover.length > 0) {
        popover[0].remove();
        // Hide the event tooltip, if it exists
        const tooltip = bootstrap.Tooltip.getInstance(info.el);
        if (tooltip) {
          tooltip.hide();
        }
      }

      // Store initial set of participants
      const originalParticipants = info.event.extendedProps.participants ? [...info.event.extendedProps.participants] : [];
      const originalPendingParticipants = info.event.extendedProps.pending_participants ? [...info.event.extendedProps.pending_participants] : [];

      showEventModal(info);

      /* ------------------------------------------ EVENT VIEW MODAL ---------------------------------------------- */

      // Set the Date Time field in the View event modal
      function setDateTime(timestamp, event_time) {
        // Create a Date object from the timestamp
        const eventDate = new Date(timestamp);
        const utcTime = new Date(eventDate.toISOString().slice(0, 19)); // Output: 2025-04-08T10:00:00

        // Extract date components
        const year = utcTime.getFullYear();
        const month = String(utcTime.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day = String(utcTime.getDate()).padStart(2, '0');

        // Extract time components
        const hours = String(utcTime.getHours()).padStart(2, '0');
        const minutes = String(utcTime.getMinutes()).padStart(2, '0');

        // Format for date input (YYYY-MM-DD)
        const dateValue = `${year}-${month}-${day}`;

        // Format for time input (HH:MM)
        const timeValue = `${hours}:${minutes}`;

        if (event_time === "start-datetime") {
          // Set values to your input fields
          document.getElementById('view-event-start-date').value = dateValue;
          document.getElementById('view-event-start-time').value = timeValue;
        }
        else {
          // Set values to your input fields
          document.getElementById('view-event-end-date').value = dateValue;
          document.getElementById('view-event-end-time').value = timeValue;
        }
      }

      // Prepares the event information modal 
      function showEventModal(info) {
        cleanupResources("modal");
        const modal = new bootstrap.Modal('#modal-view-event');
        $('.event-title').text(info.event.title);
        $('.event-body').html(
          info.event.extendedProps?.description ||
          'No description available'
        );

        setDateTime(info.event.start, "start-datetime");
        setDateTime(info.event.end, "end-datetime");

        const group_id = document.getElementById('group-select').value;
        const group_permission = info.event.extendedProps.event_edit_permission;
        if (group_id != 1) {
          document.getElementById("participants-section").style.display = 'block';
          if (group_permission !== 'Viewer') {
            document.getElementById("modal-view-add-participant-select").style.display = 'flex';
            document.getElementById("modalCloseViewEvent").style.display = 'none';
            document.getElementById('view-event-start-date').readOnly = false;
            document.getElementById('view-event-start-time').readOnly = false;
            document.getElementById('view-event-end-date').readOnly = false;
            document.getElementById('view-event-end-time').readOnly = false;
            document.getElementById("model-view-title-editable").setAttribute('contenteditable', 'true');
            document.getElementById("model-view-description-editable").setAttribute('contenteditable', 'true');
          }
          else {
            document.getElementById("modal-view-add-participant-select").style.display = 'none';
            document.getElementById("modalCloseViewEvent").style.display = 'block';
            document.getElementById('view-event-start-date').readOnly = true;
            document.getElementById('view-event-start-time').readOnly = true;
            document.getElementById('view-event-end-date').readOnly = true;
            document.getElementById('view-event-end-time').readOnly = true;
            document.getElementById("model-view-title-editable").setAttribute('contenteditable', 'false');
            document.getElementById("model-view-description-editable").setAttribute('contenteditable', 'false');
          }
          setupParticipantsSection(info, group_permission);
        } else {
          if (info.event.extendedProps.event_type === 'group') {
            document.getElementById("participants-section").style.display = 'block';
            setupParticipantsSection(info, 'Viewer');
            document.getElementById("modal-view-add-participant-select").style.display = 'none';
            document.getElementById('view-event-start-date').readOnly = true;
            document.getElementById('view-event-start-time').readOnly = true;
            document.getElementById('view-event-end-date').readOnly = true;
            document.getElementById('view-event-end-time').readOnly = true;
            document.getElementById("model-view-title-editable").setAttribute('contenteditable', 'false');
            document.getElementById("model-view-description-editable").setAttribute('contenteditable', 'false');
            document.getElementById("modalCloseViewEvent").style.display = 'block';
          }
          else {
            document.getElementById("participants-section").style.display = 'none';
            document.getElementById("modal-view-add-participant-select").style.display = 'none';
            document.getElementById('view-event-start-date').readOnly = false;
            document.getElementById('view-event-start-time').readOnly = false;
            document.getElementById('view-event-end-date').readOnly = false;
            document.getElementById('view-event-end-time').readOnly = false;
            document.getElementById("model-view-title-editable").setAttribute('contenteditable', 'true');
            document.getElementById("model-view-description-editable").setAttribute('contenteditable', 'true');
            document.getElementById("modalCloseViewEvent").style.display = 'none';
          }
        }

        setupEventActions(info);

        info.jsEvent.preventDefault();
        modal.show();
      }

      // To refresh the participants in accepted, decline and pending list in the modal
      function refreshParticipantsList(info, permission) {
        const participantsList = document.getElementById('participants-list');
        const divToRemove = document.getElementById('ssa');
        if (divToRemove) divToRemove.remove();
        const divToRemove2 = document.getElementById('ssd');
        if (divToRemove2) divToRemove2.remove();
        const divToRemove3 = document.getElementById('ssp');
        if (divToRemove3) divToRemove3.remove();
        participantsList.innerHTML = '';

        const participants = info.event.extendedProps.participants || [];
        if (participants.length > 0) {
          // Accepted participant
          const accepted_participants = info.event.extendedProps.accepted_participants || []
          if (accepted_participants.length > 0) {
            const status_section = document.createElement('div');
            status_section.className = "status-section accepted";
            status_section.id = "ssa";
            status_section.innerHTML = `<h6>Accepted (${accepted_participants.length})</h6>`;
            accepted_participants.forEach(participant => {
              renderParticipant(info, participant, participants.length > 1, permission, status_section);
            });
            participantsList.appendChild(status_section);
          }

          // Declined participant
          const declined_participants = info.event.extendedProps.declined_participants || []
          if (declined_participants.length > 0) {
            const status_section = document.createElement('div');
            status_section.className = "status-section declined";
            status_section.id = "ssd";
            status_section.innerHTML = `<h6>Declined (${declined_participants.length})</h6>`;
            declined_participants.forEach(participant => {
              renderParticipant(info, participant, participants.length > 1, permission, status_section);
            });
            participantsList.appendChild(status_section);
          }

          // Pending participant
          const pending_participants = info.event.extendedProps.pending_participants || []
          if (pending_participants.length > 0) {
            const status_section = document.createElement('div');
            status_section.className = "status-section pending";
            status_section.id = "ssp";
            status_section.innerHTML = `<h6>Pending (${pending_participants.length})</h6>`;
            pending_participants.forEach(participant => {
              renderParticipant(info, participant, participants.length > 1, permission, status_section);
            });
            participantsList.appendChild(status_section);
          }
        } else {
          const noParticipants = document.createElement('p');
          noParticipants.textContent = 'No participants';
          noParticipants.className = 'text-muted';
          participantsList.appendChild(noParticipants);
        }
      }

      // To refetch the available group member list for Add Participant selection in event modal
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
                  .attr('data-name', member.name)
              );
            });
          },
          error: function () {
            $('#updateParticipantSelect').html('<option value="" disabled>Error loading participants</option>');
          }
        });
      }

      // To set up Add participant selection in event modal as per group members
      function setupParticipantsSection(info, permission) {
        refreshParticipantsList(info, permission);

        if (permission !== 'Viewer') {
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
      }

      // To setup event remove and save button handler in event modal 
      function setupEventActions(info) {
        const group_id = document.getElementById('group-select').value;
        const group_permission = info.event.extendedProps.event_edit_permission;;

        if (group_permission === 'Viewer' || (group_id == 1 && info.event.extendedProps.event_type === 'group')) {
          document.getElementById('removeEvent').style.display = 'none';
          document.getElementById('saveViewEvent').style.display = 'none';
        } else {
          document.getElementById('removeEvent').style.display = 'block';
          document.getElementById('saveViewEvent').style.display = 'block';

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
      }

      // To render each participant in the event modal participant list
      function renderParticipant(info, participant, showRemoveButton, permission, externalDiv) {
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

        if (showRemoveButton && permission !== 'Viewer') {
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

        externalDiv.appendChild(participantElement);
      }

      // To add selected participant in event modal view participant list
      function viewAddParticipant(info) {
        const input = document.getElementById('updateParticipantSelect');
        const email = input.value.trim();
        const name = input.querySelector(`option[value="${email}"]`).dataset.name;

        if (email) {
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

          const dataString = `{"name":"${name}", "email":"${email}" }`;
          const data = JSON.parse(dataString);
          participants.push(data);
          info.event.setExtendedProp('participants', participants);

          // Update the info for pending participants
          const pending_participants = info.event.extendedProps.pending_participants || [];
          pending_participants.push(data);
          info.event.setExtendedProp('pending_participants', pending_participants);

          const group_id = document.getElementById('group-select').value;
          const group_permission = info.event.extendedProps.event_edit_permission;
          refreshParticipantsList(info, group_permission);

          input.value = '';
        }
      }

      // To remove participant from the event modal view participant list
      function viewRemoveParticipant(info, email) {
        document.getElementById(`participant-email-${email}`)?.remove();
        const participants = info.event.extendedProps.participants || [];
        const updatedParticipants = participants.filter(p => p.email !== email);
        info.event.setExtendedProp('participants', updatedParticipants);

        if (updatedParticipants.length == 1) {
          updatedParticipants.forEach(p => {
            document.getElementById(`modal-view-participant-remove-button-${p.email}`)?.remove();
          });
        }

        const inAccepted = info.event.extendedProps.accepted_participants.find(user => user.email === email) !== undefined;
        const inDecline = info.event.extendedProps.declined_participants.find(user => user.email === email) !== undefined;

        if (inAccepted) {
          const accepted_participants = info.event.extendedProps.accepted_participants || [];
          const updated_accepted_participants = accepted_participants.filter(p => p.email !== email);
          info.event.setExtendedProp('accepted_participants', updated_accepted_participants);
        } else if (inDecline) {
          const declined_participants = info.event.extendedProps.declined_participants || [];
          const updated_declined_participants = declined_participants.filter(p => p.email !== email);
          info.event.setExtendedProp('declined_participants', updated_declined_participants);
        } else {
          const pending_participants = info.event.extendedProps.pending_participants || [];
          const updated_pending_participants = pending_participants.filter(p => p.email !== email);
          info.event.setExtendedProp('pending_participants', updated_pending_participants);
        }

        const group_id = document.getElementById('group-select').value;
        const group_permission = info.event.extendedProps.event_edit_permission;
        refreshParticipantsList(info, group_permission);
      }

      function getDateTime(dateInput, timeInput) {
        // Combine date and time strings
        const dateTimeString = `${dateInput}T${timeInput}`;
        return dateTimeString;
      }

      // To update the event information by sending PUT request to backend
      function saveViewEvent(event) {
        const eventTitle = $('#model-view-title-editable').text().trim();

        // Get values from HTML inputs
        const startDateValue = document.getElementById('view-event-start-date').value; // e.g., "2025-04-08"
        const startTimeValue = document.getElementById('view-event-start-time').value; // e.g., "05:30" in 24-hour format

        // Get values from HTML inputs
        const endDateValue = document.getElementById('view-event-end-date').value; // e.g., "2025-04-08"
        const endTimeValue = document.getElementById('view-event-end-time').value; // e.g., "05:30" in 24-hour format

        const eventStart = getDateTime(startDateValue, startTimeValue);
        const eventEnd = getDateTime(endDateValue, endTimeValue);

        const description = document.getElementById("model-view-description-editable").innerText.trim();

        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').hide();

        let isValid = true;

        if (!eventTitle) {
          showError('model-view-title-editable', 'Event title is required');
          isValid = false;
          return;
        }

        const sdate = new Date(eventStart);
        const edate = new Date(eventEnd);
        // Extract year, month, and day for each date
        const d1 = new Date(sdate.getFullYear(), sdate.getMonth(), sdate.getDate());
        const d2 = new Date(edate.getFullYear(), edate.getMonth(), edate.getDate());
        if (d1 > d2) {
          showError('view-event-end-date', 'End Date must be after start Date');
          isValid = false;
          return;
        }
        else if (d1 == d2) {
          if (sdate.getHours() > edate.getHours()) {
            showError('view-event-end-time', 'End time must be after start time');
            isValid = false;
            return;
          }
          else if (sdate.getHours() === edate.getHours()) {
            if (sdate.getMinutes() >= edate.getMinutes()) {
              showError('view-event-end-time', 'End time must be after start time');
              isValid = false;
              return;
            }
          }
        }

        if (isValid) {
          $('#modal-view-event').modal('hide');

          let added_participants = [];
          let changed_participants = [];
          const currentPendingParticipants = event.extendedProps.pending_participants || [];
          currentPendingParticipants.forEach(participant => {
            const isOriginalPending = originalPendingParticipants.some(item => item.email === participant.email);
            if (!isOriginalPending) {
              const wasOriginalParticipant = originalParticipants.some(item => item.email === participant.email);
              if (wasOriginalParticipant) {
                changed_participants.push(participant.email);
              }
              else {
                added_participants.push(participant.email);
              }
            }
          });

          let deleted_participants = [];
          const currentParticipant = event.extendedProps.participants || [];
          originalParticipants.forEach(participant => {
            const isCurrentParticpant = currentParticipant.some(item => item.email === participant.email);
            if (!isCurrentParticpant) {
              deleted_participants.push(participant.email);
            }
          });

          $.ajax({
            url: `/update_event/${event.extendedProps.event_id}`,
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
              version: event.extendedProps.version,
              title: eventTitle,
              start: eventStart,
              end: eventEnd,
              description: description,
              added_participants: added_participants,
              changed_participants: changed_participants,
              deleted_participants: deleted_participants
            }),
            success: function (response) {
              // Clear cache when group changes
              const group_id = document.getElementById('group-select').value;
              calendar.removeAllEvents();
              cleanupResources("all");
              calendar.refetchEvents();

              showFlashMessage('success', response.message);
            },
            error: function (response) {
              const errorResponse = JSON.parse(response.responseText);

              // Clear cache when group changes
              const group_id = document.getElementById('group-select').value;
              calendarCache.clear(group_id);
              if (group_id !== 1) {
                // Clear cache of the dashboard as it might have changed due to group event
                calendarCache.clear(1);
              }
              calendar.removeAllEvents();
              cleanupResources("all");
              calendar.refetchEvents();

              showFlashMessage('error', errorResponse.error);
            }
          });
        }
      }

      // To remove event by sending DELETE request to backend
      function removeEvent(event) {
        $('#modal-view-event').modal('hide');
        var event_id = event.extendedProps.event_id;
        $.ajax({
          url: `/remove_event/${event_id}`,
          type: 'DELETE',
          contentType: 'application/json',
          success: function (response) {
            // Clear cache when group changes
            const group_id = document.getElementById('group-select').value;
            if (group_id !== 1) {
              // Clear cache of the dashboard as it might have changed due to group event
              calendarCache.clearEvent(1, event_id);
            }
            calendarCache.clearEvent(group_id, event_id);
            event.remove();
            showFlashMessage('success', response.message);
          },
          error: function (response) {
            const errorResponse = JSON.parse(response.responseText);

            // Clear cache when group changes
            const group_id = document.getElementById('group-select').value;
            calendarCache.clear(group_id);
            if (group_id !== 1) {
              // Clear cache of the dashboard as it might have changed due to group event
              calendarCache.clear(1);
            }
            calendar.removeAllEvents();
            cleanupResources("all");
            calendar.refetchEvents();

            showFlashMessage('error', errorResponse.error);
          }
        });
      }
      /* ------------------------------------------ EVENT VIEW MODAL ---------------------------------------------- */
    },
    select: function (arg) {

      // Get the current user permission corresponding to the group
      permission = 'Admin';
      const group_id = document.getElementById('group-select').value;
      if (group_id != 1) {
        $.ajax({
          url: `/get_group_permission/${group_id}`,
          type: "GET",
          contentType: "application/json",
          success: function (response) {
            permission = response.permission
          },
          error: function (response) {
            const errorResponse = JSON.parse(response.responseText);
            showFlashMessage('error', errorResponse.error);
          }
        });
      }

      handleCalendarSelection(arg, permission);

      /* ------------------------------------------ EVENT ADDITION MODAL ------------------------------------------ */

      // Helper functions to get the selected participants while event creation
      function getSelectedParticipants() {
        const badges = document.querySelectorAll('#eventParticipantsList .badge');
        return Array.from(badges).map(badge => ({
          name: badge.childNodes[0].textContent.trim()
        }));
      }

      // To Prepare the modal for event creation based on group-permission of current user
      function handleCalendarSelection(arg, group_permission) {
        const group_id = document.getElementById('group-select').value;

        if (group_permission !== 'Viewer') {
          prepareEventCreationModal(group_id, arg);
        } else {
          showFlashMessage('error', 'Only View Permission');
        }
      }

      // Prepares the event creation modal
      function prepareEventCreationModal(group_id, arg) {
        cleanupResources("modal");
        if (group_id == 1) {
          document.getElementById('participants').style.display = 'none';
        } else {
          document.getElementById('participants').style.display = 'block';
          showParticipants();
        }

        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').hide();

        // Set the Start and End time in the modal
        const startDate = new Date(arg.startStr);
        const endDate = new Date(arg.endStr);
        $('#eventStart').val(startDate.toISOString().slice(0, 16));
        $('#eventEnd').val(endDate.toISOString().slice(0, 16));

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

      // To facilitate selection of participants in event creation based on group members
      function showParticipants() {
        const container = document.getElementById('eventParticipantsList');
        container.innerHTML = '';

        const userEmail = document.querySelector('meta[name="user-email"]').content;
        const currentUser = document.createElement('span');
        currentUser.className = 'badge d-flex align-items-center';
        currentUser.style = 'background:rgb(30, 18, 82);';
        currentUser.innerHTML = userEmail;
        container.appendChild(currentUser);

        // Add participants for events functionality
        const participants = [];

        const loadHandler = () => loadMembers();
        $('#participantSelect').off('focus').on('focus', loadHandler);
        calendarResources.modalListeners.push({
          element: $('#participantSelect'),
          event: 'focus',
          handler: loadHandler
        });
        loadMembers();

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

        // Load members for participant selection
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

        // Add participant in the participation select list
        function addParticipant() {
          const input = document.getElementById('participantSelect');
          const name = input.value.trim();

          if (name && !participants.includes(name)) {
            participants.push(name);
            renderParticipantsList();
            input.value = '';
          }
        }

        // Remove participant from the participation select list
        function removeParticipant(name) {
          const index = participants.indexOf(name);
          if (index !== -1) {
            participants.splice(index, 1);
            renderParticipantsList();
          }
        }

        // Render participant in the participation select list
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

      // Send the new event information to add_event API
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
          document.getElementById('add-event').reset();
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
              // Clear cache when group changes
              const group_id = document.getElementById('group-select').value;
              calendar.removeAllEvents();
              cleanupResources("all");
              calendar.refetchEvents();
              showFlashMessage('success', response.message);
            },
            error: function (response) {
              const errorResponse = JSON.parse(response.responseText);
              // Clear cache when group changes
              const group_id = document.getElementById('group-select').value;
              calendarCache.clear(group_id);
              if (group_id !== 1) {
                // Clear cache of the dashboard as it might have changed due to group event
                calendarCache.clear(1);
              }
              calendar.removeAllEvents();
              cleanupResources("all");
              calendar.refetchEvents();
              showFlashMessage('error', errorResponse.error);
            }
          });
        }
      }

      /* ------------------------------------------ EVENT ADDITION MODAL ------------------------------------------ */
    }
  });

  // To render the calendar
  calendar.render();

  // Group selection change handler
  document.getElementById('group-select').addEventListener('change', function () {
    calendar.removeAllEvents();
    cleanupResources("all");
    calendar.refetchEvents();
  });

  checkInvt.addEventListener('click', check_invites);
  // Create check invite modal functionality
  function check_invites() {
    // Create modal HTML if it doesn't exist
    if (!document.getElementById('modal-check-invites')) {
      const modalHTML = `
      <div class="modal fade" id="modal-check-invites" tabindex="-1" aria-labelledby="checkInvitesModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-lg">
              <div class="modal-content">
                  <div class="modal-header">
                      <h5 class="modal-title" id="checkInvitesModalLabel">Pending Invitations</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body p-0">
                      <div id="invitesContainer" class="list-group list-group-flush">
                          <div class="list-group-item text-center py-3">
                              <div class="spinner-border" role="status">
                                  <span class="visually-hidden">Loading...</span>
                              </div>
                              <p class="mb-0 mt-2">Loading invitations...</p>
                          </div>
                      </div>
                  </div>
                  <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                  </div>
              </div>
          </div>
      </div>

      <!-- Description popup modal -->
      <div class="modal fade" id="descriptionPopup" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
          <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content">
                  <div class="modal-header">
                      <h5 class="modal-title" id="descriptionPopupTitle">Description</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body" id="descriptionPopupContent" style="overflow-wrap: break-word; max-height: 60vh; overflow-y: auto;"></div>
                  <div class="modal-footer">
                      <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Close</button>
                  </div>
              </div>
          </div>
      </div>`;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Initialize modal
    const modalEl = document.getElementById('modal-check-invites');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // Show modal
    modal.show();

    // Fetch invites from server
    $.ajax({
      url: '/check_invites',
      type: 'GET',
      success: function (response) {
        const container = $('#invitesContainer');
        container.empty();

        if (response.length === 0) {
          container.html('<div class="text-center py-3"><p>No pending invitations</p></div>');
          return;
        }

        // Separate group and event invites
        const groupInvites = response.filter(invite => invite.type === 'group');
        const eventInvites = response.filter(invite => invite.type === 'event');

        // Group invite template
        const groupInviteHTML = (invite) => `
          <div class="list-group-item d-flex justify-content-between align-items-center py-2" id="invite-${invite.id}">
              <div class="d-flex flex-column flex-grow-1 pe-3" style="min-width: 0;">
                  <div class="d-flex align-items-center">
                      <span class="badge bg-primary me-2">GROUP</span>
                      <strong class="text-truncate">${invite.name}</strong>
                  </div>
                  <div class="d-flex mt-1">
                      <small class="text-muted text-truncate description-short" 
                          style="cursor: pointer;"
                          data-full-desc="${invite.description}" 
                          data-title="${invite.name} Description">
                          <i class="bi bi-info-circle me-1"></i>
                          ${invite.description.length > 50 ? invite.description.substring(0, 50) + '...' : invite.description}
                      </small>
                  </div>
              </div>
              <div class="d-flex flex-shrink-0">
                  <button class="btn btn-outline-success me-2 accept-btn" data-id="${invite.id}" data-type="group">
                      <i class="bx bx-check" style="font-size:1.5rem; font-weight:bold;"></i>
                  </button>
                  <button class="btn btn-outline-danger decline-btn" data-id="${invite.id}" data-type="group">
                      <i class="bx bx-x" style="font-size:1.5rem; font-weight:bold;"></i>
                  </button>
              </div>
          </div>`;

        // Event invite template
        const eventInviteHTML = (invite) => `
          <div class="list-group-item d-flex justify-content-between align-items-center py-2" id="invite-${invite.id}">
              <div class="d-flex flex-column flex-grow-1 pe-3" style="min-width: 0;">
                  <div class="d-flex align-items-center">
                      <span class="badge bg-warning text-dark me-2">EVENT</span>
                      <strong class="text-truncate">${invite.name}</strong>
                      <span class="text-muted ms-2">
                          <i class="bx bx-group"></i>
                          ${invite.group}
                      </span>
                  </div>
                  <div class="d-flex mt-1">
                      <small class="text-muted text-truncate description-short" 
                          style="cursor: pointer;"
                          data-full-desc="${invite.description}" 
                          data-title="${invite.name} Description">
                          <i class="bi bi-info-circle me-1"></i>
                          ${invite.description.length > 50 ? invite.description.substring(0, 50) + '...' : invite.description}
                      </small>
                  </div>
                  <div class="d-flex flex-wrap mt-1 gap-2">
                      <small class="text-muted">
                          <i class="bi bi-clock me-1"></i>
                          ${invite.start_time} - ${invite.end_time}
                      </small>
                      <small class="text-muted">
                          <i class="bi bi-person me-1"></i>
                          ${invite.creator}
                      </small>
                  </div>
              </div>
              <div class="d-flex flex-shrink-0">
                  <button class="btn btn-sm btn-outline-success me-2 accept-btn" data-id="${invite.id}" data-type="event">
                      <i class="bx bx-check" style="font-size:1.5rem; font-weight:bold;"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger decline-btn" data-id="${invite.id}" data-type="event">
                      <i class="bx bx-x" style="font-size:1.5rem; font-weight:bold;"></i>
                  </button>
              </div>
          </div>`;

        if (groupInvites.length > 0) {
          groupInvites.forEach(invite => {
            if (invite.description.length == 0)
              invite.description = "No description";
            container.append(groupInviteHTML(invite));
          });
        }

        if (eventInvites.length > 0) {
          eventInvites.forEach(invite => {
            if (invite.description.length == 0)
              invite.description = "No description";
            container.append(eventInviteHTML(invite));
          });
        }

        // Setup description click handlers
        $('.description-short').click(function () {
          const fullDesc = $(this).data('full-desc');
          const title = $(this).data('title');

          $('#descriptionPopupTitle').text(title);
          $('#descriptionPopupContent').html(fullDesc.replace(/\n/g, '<br>'));

          const descModal = new bootstrap.Modal(document.getElementById('descriptionPopup'));
          descModal.show();
        });

        // Setup accept/decline button handlers
        $('.accept-btn').click(function () {
          const id = $(this).data('id');
          const type = $(this).data('type');
          respondToInvite(id, type, 'Accepted');
        });

        $('.decline-btn').click(function () {
          const id = $(this).data('id');
          const type = $(this).data('type');
          respondToInvite(id, type, 'Declined');
        });
      },
      error: function () {
        $('#invitesContainer').html(
          '<div class="alert alert-danger">Error loading invitations. Please try again later.</div>'
        );
      }
    });

    function respondToInvite(id, type, status) {
      $.ajax({
        url: '/check_invites',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          invite_id: id,
          invite_type: type,
          status: status
        }),
        success: function (response) {
          if (type === 'group') {
            // Update the group-select 
            // Group invites accepted / rejected
            $.ajax({
              url: '/get_groups',
              type: 'GET',
              success: function (data) {
                const select = $('#group-select');
                select.empty().append('<option id="group-select-option-1" value="1">Dashboard</option>');

                $.each(data, function (index, group) {
                  select.append(
                    $('<option></option>')
                      .attr('id', 'group-select-option-' + group.group_id)
                      .val(group.group_id)
                      .text(group.name)
                  );
                });

                fetch_unread_notifications_count();   // Refresh the notification count
                fetch_pending_invites_count(); // Refresh the invite count
              },
              error: function () {
                $('#group-select').html('<option value="" disabled>Error loading groups</option>');
              }
            });
          }
          else {
            // Event invites accepted / rejected
            // If it is a invite for a event, we need to refresh group as well as dashboard events
            calendar.removeAllEvents();
            cleanupResources("all");
            calendar.refetchEvents();
          }

          // Remove the invite from view
          $(`#invite-${id}`).fadeOut(300, function () {
            $(this).remove();

            // Check if no invites left
            const $invites = $('#invitesContainer .list-group-item[id^="invite-"]');
            if ($invites.length === 0) {
              $('#invitesContainer').append(
                '<div class="text-center py-3"><p>No pending invitations</p></div>'
              );
            }
          });

          // Show success message
          const message = status === 'Accepted'
            ? 'Invitation accepted successfully'
            : 'Invitation declined';

          const flashHTML = `
              <div class="alert alert-dismissible fade show" role="alert"
                  style="background-color:white; color:black; padding:10px; margin-right:5px;" id="invite-response-success">
                  <i class="bx bx-check-circle" style="color:lawngreen;"></i>
                  ${message}
              </div>`;
          document.body.insertAdjacentHTML('beforeend', flashHTML);

          // Auto-remove after 3 seconds
          setTimeout(function () {
            const flashElements = document.querySelectorAll('#invite-response-success');
            if (flashElements) {
              flashElements.forEach(flashElement => {
                flashElement.style.opacity = '0';
                setTimeout(() => flashElement.remove(), 2000);
              });
            }
          }, 1000);
        },
        error: function (response) {
          const errorResponse = JSON.parse(response.responseText);
          showFlashMessage('error', errorResponse.error);
          modal.hide();
          fetch_unread_notifications_count();   // Refresh the notification count
          fetch_pending_invites_count(); // Refresh the invite count
        }
      });
    }
  }

  function showError(fieldId, message) {
    $(`#${fieldId}`).addClass('is-invalid');
    $(`#${fieldId}`).next('.invalid-feedback').text(message).show();
  }

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
    if (groupId == 1) {
      const settingsBtn = document.querySelector('#group-settings');
      settingsBtn.setAttribute('data-bs-toggle', 'tooltip');
      settingsBtn.setAttribute('data-bs-placement', 'top');
      settingsBtn.setAttribute('title', 'Please select a group');

      const tooltip = new bootstrap.Tooltip(settingsBtn, {
        trigger: 'manual'
      });
      tooltip.show();

      setTimeout(() => {
        tooltip.hide();
        settingsBtn.removeAttribute('data-bs-toggle');
        settingsBtn.removeAttribute('data-bs-placement');
        settingsBtn.removeAttribute('title');
      }, 2000);
      return;
    }
    let isAdmin = false;
    var curr_email;
    var version;
    $.ajax({
      url: `/group_info/${groupId}`,
      type: 'GET',
      success: function (groupData) {
        originalData = {
          name: groupData['name'],
          description: groupData['description'],
          members: groupData['members']
        };
        version = groupData['version'];
        curr_email = groupData['curr_email'];
        isAdmin = groupData['authorization'];
        originalData.members = originalData.members.sort((a, b) => {
          // If current user is admin, put them first
          if (isAdmin && a.email === curr_email) return -1;
          if (isAdmin && b.email === curr_email) return 1;
          // Sort by role priority
          const roleOrder = { Admin: 1, Editor: 2, Viewer: 3 };
          return roleOrder[a.role] - roleOrder[b.role];
        });

        currentData = { ...originalData };
        members = originalData.members.map(member => ({ ...member }));

        createAndShowModal(isAdmin, groupId);
      },
      error: function (response) {
        const errorResponse = JSON.parse(response.responseText);
        showFlashMessage('error', errorResponse.error);
      }
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
                      <div class="ms-auto">
                          <button type="button" class="btn btn-danger me-4" id="exitGroupBtn">
                            <i class="bi bi-person-dash"></i> Exit Group
                          </button>
                          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                      </div>
                  </div>
                  <div class="modal-body">
                      <form id="editGroupForm">
                          <style>
                              .form-label {
                              font-weight: 600;
                              letter-spacing: 0.010em;
                              font-size: 18px;
                              margin-bottom: 2px;
                              }
                          </style>
                          <div class="mb-3">
                              <label class="form-label">Group Name</label>
                              <div id="groupNameContainer" class="editable-field" style="min-height: 38px;">
                                  <span id="groupNameDisplay" class="editable-text"></span>
                                  <input type="text" class="form-control d-none" id="editGroupName" required>
                                  <div class="invalid-feedback"></div>
                              </div>
                              <div class="invalid-feedback"></div>
                          </div>
                          <div class="mb-3">
                              <label class="form-label">Description</label>
                              <div id="groupDescContainer" class="editable-field" style="min-height: 38px; overflow-wrap: break-word;">
                                  <div id="groupDescDisplay" class="editable-text" style="white-space: pre-wrap;"></div>
                                  <textarea class="form-control d-none" id="editGroupDescription"></textarea>
                              </div>
                          </div>
                          <div class="mb-3">
                              <label class="form-label">Members</label>
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
                               <div id="editmember-invalid-feedback" class="invalid-feedback mb-2"></div>
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
      if (originalData.description) {
        $('#groupDescDisplay').text(originalData.description);
      }
      else {
        $('#groupDescDisplay').text("No description");
      }
      renderMembersList();

      $('#exitGroupBtn').click(() => {
        if (confirm('Are you sure you want to leave this group?')) {
          $.ajax({
            url: `/exit_group/${groupId}`,
            type: 'DELETE',
            success: () => {
              modal.hide();
              showFlashMessage('success', 'Exited Group');
              refreshGroupList(1, true);
              // Delete the cache of the group events
              calendarCache.clear(groupId);
            },
            error: function (response) {
              const errorResponse = JSON.parse(response.responseText);
              showFlashMessage('error', errorResponse.error);
              modal.hide();
            }
          });
        }
      });

      // Show modal after data loads
      modal.show();

      // Initialize editable fields (for admins only)
      if (isAdmin) {
        // Group name editing
        $('#groupNameContainer').on('click', function () {
          if ($(this).hasClass('editing')) return;

          $(this).addClass('editing');
          $('#groupNameDisplay').addClass('d-none');
          $('#editGroupName')
            .removeClass('d-none')
            .val(currentData.name)
            .focus();
        });

        $('#editGroupName').on('blur', function () {
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
        $('#groupDescContainer').on('click', function () {
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

        $('#editGroupDescription').on('blur', function () {
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
        $('#editMemberInput').keypress(function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            addMember();
          }
        });

        // Role dropdown
        $(document).on('click', '[data-role]', function () {
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
                showFlashMessage('success', 'Group deleted successfully');
                refreshGroupList(1, true);
                // Delete the cache of the group events
                calendarCache.clear(groupId);
              },
              error: function (response) {
                const errorResponse = JSON.parse(response.responseText);
                showFlashMessage('error', errorResponse.error);
                modal.hide();
              }
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
      const status = 'Pending';

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

      members.push({ email, role, status });
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
                      ${(isAdmin && member.email != curr_email) ? `
                      <div class="btn-group">
                          <span class="badge bg-secondary ms-2 dropdown-toggle role-badge" data-bs-toggle="dropdown" style="cursor: pointer;">
                            ${member.role}
                          </span>
                          <ul class="dropdown-menu">
                              <li><a class="dropdown-item" data-member-role="Viewer">Viewer</a></li>
                              <li><a class="dropdown-item" data-member-role="Editor">Editor</a></li>
                              <li><a class="dropdown-item" data-member-role="Admin">Admin</a></li>
                          </ul>
                      </div>
                      ` : `<span class="badge bg-secondary ms-2">${member.role}</span>`}
                      ${(member.status == 'Pending') ? `<span class="badge text-danger opacity-75 ms-2">(${member.status})</span>` : ''}
                  </div>
                  ${(isAdmin && member.email != curr_email) ? `
                  <button class="btn btn-xs btn-outline-danger remove-member" style="line-height: 0.8" data-email="${member.email}">
                      <i class="bx bx-x" style="font-size:1.5rem; font-weight:bold;"></i>
                  </button>
                  ` : ''}
              </div>
          `);

        $container.append($item);
      });

      // Add remove handler for new buttons
      $('.remove-member').click(function () {
        removeMember($(this).data('email'));
      });

      // Add role change handler
      $('[data-member-role]').click(function () {
        const newRole = $(this).data('member-role');
        const email = $(this).closest('.list-group-item').find('.fw-bold').text();
        const memberIndex = members.findIndex(m => m.email === email);
        if (memberIndex !== -1) {
          members[memberIndex].role = newRole;
          $(this).closest('.btn-group').find('.role-badge').text(newRole);
          checkForChanges();
        }
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

      var name_changed = originalData.name !== currentData.name;
      var members_changed = JSON.stringify(members) !== JSON.stringify(originalData.members);

      const origEmails = new Set(originalData.members.map(m => m.email));
      const currEmails = new Set(members.map(m => m.email));

      const new_members = members.filter(m => !origEmails.has(m.email)).map(m => ({ email: m.email, role: m.role }));
      const deleted_members = originalData.members.filter(m => !currEmails.has(m.email)).map(m => ({ email: m.email, role: m.role }));
      const updated_members = originalData.members
        .filter(o => members.some(c => c.email === o.email && c.role !== o.role))
        .map(o => ({
          email: o.email,
          role: members.find(c => c.email === o.email).role
        }));

      $.ajax({
        url: `/group_info/${groupId}`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({
          version: version,
          name: currentData.name,
          description: currentData.description,
          new_members: new_members,
          deleted_members: deleted_members,
          updated_members: updated_members
        }),
        success: function (data) {
          version = data['version'];
          showFlashMessage('success', 'Group updated successfully');
          originalData = { ...currentData };
          originalData.members = members
            .filter(member => !(data['emails'].includes(member.email.toLowerCase())))
            .map(member => ({ ...member }))
            .sort((a, b) => {
              // If current user is admin, put them first
              if (isAdmin && a.email === curr_email) return -1;
              if (isAdmin && b.email === curr_email) return 1;
              // Sort by role priority
              const roleOrder = { Admin: 1, Editor: 2, Viewer: 3 };
              return roleOrder[a.role] - roleOrder[b.role];
            });
          members = originalData.members.map(member => ({ ...member }));

          if (data['emails'].length > 0)
            alert("No users found corresponding to:\n" + data['emails'].join("\n"));
          checkForChanges();
          renderMembersList();
          if (name_changed) {
            refreshGroupList(groupId, false);
          }
          if (members_changed) {
            // Clear cache when group changes
            const group_id = document.getElementById('group-select').value;
            calendar.removeAllEvents();
            cleanupResources("all");
            calendar.refetchEvents();
          }
        },
        error: function (response) {
          const errorResponse = JSON.parse(response.responseText);
          showFlashMessage('error', errorResponse.error);
          $('#modal-edit-group').modal('hide');
        }
      });
    }

    // Helper functions
    function validateEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function refreshGroupList(groupId, refreshEvents) {
      $.ajax({
        url: '/get_groups',
        type: 'GET',
        success: function (data) {
          const select = $('#group-select');
          select.empty().append('<option id="group-select-option-1" value="1">Dashboard</option>');

          $.each(data, function (index, group) {
            select.append(
              $('<option></option>')
                .attr('id', 'group-select-option-' + group.group_id)
                .val(group.group_id)
                .text(group.name)
            );
          });
          select.val(groupId);

          if (refreshEvents) {
            // Refresh the events in dashboard
            calendar.removeAllEvents();
            cleanupResources("all");
            calendar.refetchEvents();
          }
        },
        error: function () {
          $('#group-select').html('<option value="" disabled>Error loading groups</option>');
        }
      });
    }
  }
}

// Initialize calendar when DOM is loaded
document.addEventListener('DOMContentLoaded', load_calendar);

// ------------------------------------ NOTIFICATION HANDLER --------------------------------------------

// Notification popover functionality
const notificationBtn = document.getElementById('notificationBtn');
const notificationPopover = document.getElementById('notificationPopover');
const notificationBadge = document.getElementById('notificationBadge');

// Fetch number of unread notifications on page load
document.addEventListener('DOMContentLoaded', function () {
  fetch_unread_notifications_count();
  fetch_pending_invites_count(); // Fetch pending invites count
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


// Fetch pending invites count
function fetch_pending_invites_count() {
  $.ajax({
    url: '/get_pending_invites_count',
    type: 'GET',
    success: function (response) {
      const pendingCount = response;
      const pendingInvitesBadge = document.getElementById('inviteBadge');
      const invites_icon = document.getElementById('invites-icon');
      if (pendingCount > 0) {
        pendingInvitesBadge.textContent = pendingCount;
        if (pendingInvitesBadge.classList.contains('d-none')) {
          pendingInvitesBadge.classList.remove('d-none');
          invites_icon.classList.add('active');
        }
      }
      else {
        pendingInvitesBadge.textContent = 0;
        if (!pendingInvitesBadge.classList.contains('d-none')) {
          pendingInvitesBadge.classList.add('d-none');
          invites_icon.classList.remove('active');
        }
      }
    },
    error: function () {
      showFlashMessage('error', 'Error fetching pending invites count');
    }
  });
}

// Fetch unread notifications count
function fetch_unread_notifications_count() {
  // Check if the notification badge exists before trying to access it
  if (notificationBadge === null) return;

  $.ajax({
    url: '/get_unread_notifications_count',
    type: 'GET',
    success: function (response) {
      const unreadCount = response;
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
      showFlashMessage('error', 'Error fetching notifications count');
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
              showFlashMessage('error', 'Error marking notification as read');
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
      showFlashMessage('error', 'Error loading notifications. Please try again later.');
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

// ------------------------------------ NOTIFICATION HANDLER --------------------------------------------

// ------------------------------------- GROUP CREATION HANDLER -----------------------------------------

// Create group functionality
let createGrp = document.querySelector('#create-group-link');
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
                          <style>
                              .form-label {
                              font-weight: 600;
                              letter-spacing: 0.010em;
                              font-size: 18px;
                              margin-bottom: 2px;
                              }
                          </style>
                          <div class="mb-3">
                              <label for="groupName" class="form-label">Group Name</label>
                              <input type="text" class="form-control" id="groupName" required>
                              <div class="invalid-feedback"></div>
                          </div>
                          <div class="mb-3">
                              <label for="groupDescription" class="form-label">Description</label>
                              <textarea class="form-control" id="groupDescription" rows="6" style="min-height: 100px; resize: vertical;"></textarea>
                          </div>
                          <div class="mb-3">
                              <label class="form-label">Members</label>
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
      success: function (invalidData) {
        // Update the group-select 
        $.ajax({
          url: '/get_groups',
          type: 'GET',
          success: function (data) {
            const select = $('#group-select');
            select.empty().append('<option id="group-select-option-1" value="1">Dashboard</option>');

            $.each(data, function (index, group) {
              select.append(
                $('<option></option>')
                  .attr('id', 'group-select-option-' + group.group_id)
                  .val(group.group_id)
                  .text(group.name)
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
          const flashElements = document.querySelectorAll('#group-sub-success');
          if (flashElements) {
            flashElements.forEach(flashElement1 => {
              flashElement1.style.opacity = '0';
              setTimeout(() => flashElement1.remove(), 1000);
            });
          }
        }, 1000);

        if (invalidData['emails'].length > 0)
          alert("No users found corresponding to:\n" + invalidData['emails'].join("\n"));
      },
      error: function (response) {
        const errorResponse = JSON.parse(response.responseText);
        showFlashMessage('error', errorResponse.error);
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

// ------------------------------------- GROUP CREATION HANDLER -----------------------------------------

// ------------------------------------- USER PROFILE SETTINGS HANDLER ----------------------------------

function showProfileSettingsModal(username, useremail) {
  const existingModal = document.getElementById('profileSettingsModal');
  if (existingModal) existingModal.remove();

  // create modal HTML structure
  const modalHTML = `<!-- Modal -->
    <div class="modal fade" id="profileSettingsModal" tabindex="-1" aria-labelledby="profileSettingsModalLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="profileSettingsModalLabel">Profile Settings</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <style>
                      .form-label {
                      font-weight: 600;
                      letter-spacing: 0.010em;
                      font-size: 18px;
                      margin-bottom: 2px;
                      }
                    </style>
                    <form id="profileSettingsForm" action='/user_profile' method="POST">
                        <!-- Name Field -->
                        <div class="mb-3">
                            <label for="name" class="form-label">Name</label>
                            <input type="text" class="form-control" id="name" name="name" value="">
                            <div id="name-feedback" class="invalid-feedback"></div>
                        </div>
                        
                        <!-- Email Field -->
                        <div class="mb-3">
                            <label for="email" class="form-label">Email</label>
                            <input type="email" class="form-control" id="email" name="email" value="">
                            <div id="email-feedback" class="invalid-feedback"></div>
                        </div>
                        
                        <!-- Password Field -->
                        <div class="mb-3">
                            <label for="Password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="Password" name="password">
                            <div id="password-feedback" class="invalid-feedback"></div>
                        </div>
                        
                        <!-- Show Password Toggle -->
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="togglePassword">
                            <label class="form-check-label" for="togglePassword">
                                <span class="text-success">Show Password</span>
                            </label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" form="profileSettingsForm" class="btn btn-primary" id="save_changes_button">
                        Save changes
                    </button>
                </div>
            </div>
        </div>
    </div>`;

  // Add modal to the body
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Initialize the default value
  document.getElementById('name').value = username;
  document.getElementById('email').value = useremail;

  // Initialize the modal
  const modal = new bootstrap.Modal(document.getElementById('profileSettingsModal'));

  // Set up event listeners for the form validation
  const setupFormValidation = () => {
    const togglePassword = document.querySelector('#togglePassword');
    const password = document.querySelector('#Password');
    togglePassword.addEventListener('click', () => {
      // Toggle the type attribute using getAttribure() method
      const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
      password.setAttribute('type', type);
    });

    const name = document.querySelector('#name');
    function validateName() {
      if (name.value === '') {
        name.classList.add('is-invalid');
        document.getElementById('name-feedback').textContent = 'Username can not be empty';
        return false;
      } else {
        name.classList.remove('is-invalid');
        document.getElementById('name-feedback').textContent = '';
        return true;
      }
    }
    name.addEventListener('input', validateName);

    const email = document.querySelector('#email');
    function validateEmail() {
      // Email validation regex according to RFC 5322
      const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
      const isValidEmail = emailRegex.test(email.value);

      if (!isValidEmail) {
        email.classList.add('is-invalid');
        document.getElementById('email-feedback').textContent = 'Invalid email address'
      } else {
        email.classList.remove('is-invalid');
        document.getElementById('email-feedback').textContent = '';
      }

      return isValidEmail;
    }
    email.addEventListener('input', validateEmail);

    function checkPassword(password) {
      const minLength = 8;
      const hasMinLength = password.length >= minLength;
      const hasDigit = /\d/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasUppercase = /[A-Z]/.test(password);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

      return {
        isValid: hasMinLength && hasDigit && hasLowercase && hasUppercase && hasSpecialChar,
        hasMinLength,
        hasDigit,
        hasLowercase,
        hasUppercase,
        hasSpecialChar
      };
    };

    function updateDisplay(password, validation) {
      if (!validation.hasMinLength) {
        password.classList.add('is-invalid');
        document.getElementById('password-feedback').textContent = 'Password must be at least 8 characters';
      }
      else if (!validation.hasDigit) {
        password.classList.add('is-invalid');
        document.getElementById('password-feedback').textContent = 'Password must have atleast one digit';
      }
      else if (!validation.hasLowercase) {
        password.classList.add('is-invalid');
        document.getElementById('password-feedback').textContent = 'Password must have atleast one lowercase character';
      }
      else if (!validation.hasUppercase) {
        password.classList.add('is-invalid');
        document.getElementById('password-feedback').textContent = 'Password must have atleast one uppercase character';
      }
      else if (!validation.hasSpecialChar) {
        password.classList.add('is-invalid');
        document.getElementById('password-feedback').textContent = 'Password must have atleast one special character';
      }
      else {
        password.classList.remove('is-invalid');
        document.getElementById('password-feedback').textContent = '';
      }
    };

    function validatePassword() {
      const validation = checkPassword(password.value);
      updateDisplay(password, validation);
      return validation.isValid;
    }

    password.addEventListener('input', validatePassword);

    // Reset all the errors
    name.classList.remove('is-invalid');
    document.getElementById('name-feedback').textContent = '';
    email.classList.remove('is-invalid');
    document.getElementById('email-feedback').textContent = '';
    password.classList.remove('is-invalid');
    document.getElementById('password-feedback').textContent = '';

    // Form submission handler
    const submitBtn = document.getElementById('save_changes_button');
    submitBtn.addEventListener('click', function (event) {
      event.preventDefault();

      // Validate all fields before submission
      const isValidName = validateName();
      const isValidEmail = validateEmail();
      const isPasswordValid = validatePassword();

      if (!isValidEmail || !isPasswordValid || !isValidName) {
        event.stopPropagation();
      }
      else {
        // Send the POST request to the Flask backend
        $.ajax({
          url: '/user_profile',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({
            name: $('#name').val().trim(),
            email: $('#email').val().trim(),
            password: $('#Password').val()
          }),
          success: function () {
            modal.hide();
            showFlashMessage('success', 'Profile settings updated');
          },
          error: function (response) {
            const errorResponse = JSON.parse(response.responseText);
            showFlashMessage('error', errorResponse.error);
            modal.hide();
          }
        });
      }
    });
  };

  // Set up the validation when modal is shown
  document.getElementById('profileSettingsModal').addEventListener('shown.bs.modal', setupFormValidation);

  // Show the modal
  modal.show();
}

document.getElementById('profile-settings-link').addEventListener('click', function (e) {
  e.preventDefault();

  // GET request to get the form, name and email
  $.ajax({
    url: '/user_profile',
    type: 'GET',
    contentType: 'application/json',
    success: function (response) {
      showProfileSettingsModal(response.name, response.email);
    },
    error: function (reponse) {
      const errorResponse = JSON.parse(response.responseText);
      showFlashMessage('error', errorResponse.error);
    }
  });
});

// ------------------------------------- USER PROFILE SETTINGS HANDLER ----------------------------------
