document.addEventListener('DOMContentLoaded', function () {
    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
      timeZone: 'UTC',
      themeSystem: 'bootstrap5',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
      },
      weekNumbers: true,
      dayMaxEvents: true,
      events: '/data', // Fetch events from server
      selectable: true, // Enable date/time selection
      select: function(arg) {
          // Open the modal when a time range is selected
          $('#eventModal').modal('show');

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
      var eventEnd = $('#eventEnd').val();

      $.ajax({
        url: '/add_event',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          title: eventTitle,
          start: eventStart,
          end: eventEnd
        }),
        success: function(response) {
          calendar.addEvent({ // Add event to calendar
            title: eventTitle,
            start: eventStart,
            end: eventEnd
          });
          $('#eventModal').modal('hide');
          alert("Event added successfully");
        },
        error: function() {
          alert('Error adding event.');
        }
      });
    });
  });