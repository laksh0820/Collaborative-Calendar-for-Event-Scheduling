$(document).ready(function() {
    // To create a current date object
    const currentDate = new Date();

    $('#calendar').fullCalendar({
        header: {
            left: 'prev,next today',
            center: 'title',
            right: 'month,agendaWeek,agendaDay'
        },
        defaultDate: `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`,
        eventLimit: true, // allow "more" link when too many events
        events: '/data',
        selectable: true, // allow select option to create new events
        select: function(start, end) {
            // Open the modal when a time range is selected
            $('#eventModal').modal('show');

            // Set the start and end times in the form
            $('#eventStart').val(start.format('YYYY-MM-DD'));
            $('#eventEnd').val(end.format('YYYY-MM-DD'));
        },
        loading: function(bool) {
            $('#loading').toggle(bool);
        }
    });

    $('#saveEvent').on('click', function(event) {
        event.preventDefault();	
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
                $('#eventModal').modal('hide');
                $('#calendar').fullCalendar('renderEvent',{
                    title: eventTitle,
                    start: eventStart,
                    end: eventEnd
                },true);
                alert("Event added successfully");
            },
            error: function(){
                alert('There was an error while adding the event.');
            }
        });
    });
    
});