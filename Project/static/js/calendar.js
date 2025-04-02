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

  // Save event handler
  $('#saveEvent').on('click', function () {
    var eventTitle = $('#eventTitle').val();
    var eventStart = $('#eventStart').val();
    var description = $('#eventDescription').val();
    var eventEnd = $('#eventEnd').val();
    var userGroup = document.getElementById('group-select').value;

    $.ajax({
      url: '/add_event',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        title: eventTitle,
        description: description,
        start: eventStart,
        end: eventEnd,
        group_id: userGroup,
      }),
      success: function (response) {
        calendar.addEvent({ // Add event to calendar
          title: eventTitle,
          start: eventStart,
          description: description,
          end: eventEnd,
        });
        $('#modal-view-event-add').modal('hide');
        alert("Event added successfully");
      },
      error: function () {
        alert('Error adding event.');
      }
    });
  });
};

document.addEventListener('DOMContentLoaded', load_calendar);
