function load_calendar (group_id) {
  var calendarEl = document.getElementById('calendar');
  var calendar = new FullCalendar.Calendar(calendarEl, {
    timeZone: 'UTC',
    themeSystem: 'bootstrap5',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
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
    eventDidMount: function(info) {
      // Add tooltip if description exists
      if (info.event.extendedProps.description) {
        new bootstrap.Tooltip(info.el, {
          title: info.event.extendedProps.description,
          placement: 'top',
          trigger: 'hover'
        });
      }
    },
    events: `/data/${group_id}`, // Fetch events from server
    eventClick: function(info) {
      // Modal approach
      const modal = new bootstrap.Modal('#modal-view-event');
      $('.event-icon').html("<i class='fa fa-"+info.event.icon+"'></i>");
      $('.event-title').html(info.event.title);
      // $('.event-start').html(info.event.start.toISOString().replace('T',' ').substring(0,16));
      // $('.event-end').html(info.event.end.toISOString().replace('T',' ').substring(0,16));
      $('.event-body').html(
        info.event.extendedProps?.description || 'No description'
      );
      modal.show();
      info.jsEvent.preventDefault();
    },  
    selectable: true, // Enable date/time selection
    select: function(arg) {
        // Open the modal when a time range is selected
        $('#modal-view-event-add').modal('show');

        // Set the start and end times in the form
        $('#eventStart').val(arg.startStr);
        $('#eventEnd').val(arg.endStr);
    },
    loading: function(bool) {
        $('#loading').toggle(bool);
    }
  });

  calendar.render();

  // Save event handler
  $('#saveEvent').on('click', function() {
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
      success: function(response) {
        calendar.addEvent({ // Add event to calendar
          title: eventTitle,
          start: eventStart,
          description: description,
          end: eventEnd,
        });
        $('#modal-view-event-add').modal('hide');
        alert("Event added successfully");
      },
      error: function() {
        alert('Error adding event.');
      }
    });
  });
};

var userGroup = document.getElementById('group-select');

document.addEventListener('DOMContentLoaded', load_calendar(userGroup.value)); 

userGroup.addEventListener('change', function () {
  const group_id = this.value;
  load_calendar(group_id);
});
