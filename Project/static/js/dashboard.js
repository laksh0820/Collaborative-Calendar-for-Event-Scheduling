let btn = document.querySelector('#btn');
let sidebar = document.querySelector('.sidebar');
let searchBtn = document.querySelector('.bx-search');
let createGrp = document.querySelector('#create-group-link')

btn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

searchBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

createGrp.addEventListener('click', create_group);

function create_group() {
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
                                <label for="groupName" class="form-label">Group Name</label>
                                <input type="text" class="form-control" id="groupName" required>
                            </div>
                            <div class="mb-3">
                                <label for="groupDescription" class="form-label">Description</label>
                                <textarea class="form-control" id="groupDescription" rows="3"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Participants</label>
                                <div class="input-group mb-2">
                                    <input type="text" class="form-control" id="participantInput" placeholder="Enter email">
                                    <button class="btn btn-outline-secondary" type="button" id="addParticipantBtn">Add</button>
                                </div>
                                <div id="participantsList" class="d-flex flex-wrap gap-2"></div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="submitGroupBtn">Create Group</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Initialize modal
    const modalEl = document.getElementById('modal-create-group');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // Show modal
    modal.show();

    const participants = [];

    // Add participant functionality
    document.getElementById('addParticipantBtn')?.addEventListener('click', addParticipant);
    document.getElementById('participantInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addParticipant();
        }
    });

    // Submit button functionality
    document.getElementById('submitGroupBtn')?.addEventListener('click', submitGroup);

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

    function submitGroup() {
        const groupName = document.getElementById('groupName').value.trim();
        const description = document.getElementById('groupDescription').value.trim();

        if (!groupName) {
            // Alert that Group name is required
            return;
        }

        // Send data to server
        const groupData = {
            name: groupName,
            description: description,
            participants: participants
        };


        // Close the modal
        modal.hide();

        // Reset form
        document.getElementById('createGroupForm').reset();
        participants.length = 0;

        // Display success message
        $.ajax({
            url: '/create_group',
            type: 'GET',
            contentType: 'application/json'
        });
    }
}