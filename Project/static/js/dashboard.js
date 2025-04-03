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
                                    <button class="btn btn-light" type="button" id="addMemberBtn">Add</button>
                                </div>
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
    }

    // Initialize modal
    const modalEl = document.getElementById('modal-create-group');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // Show modal
    modal.show();

    const members = [];
    const permissions = [];

    // Add member functionality
    document.getElementById('addMemberBtn')?.addEventListener('click', addMember);
    document.getElementById('memberInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addMember();
        }
    });

    // Submit and Cancel button functionality
    document.getElementById('submitGroupBtn')?.addEventListener('click', submitGroup);
    document.getElementById('cancelGroupBtn')?.addEventListener('click', cancelGroup);

    function addMember() {
        const meminput = document.getElementById('memberInput');
        const name = meminput.value.trim();
        const perminput = document.getElementById('roleDropdown');
        const perm = perminput.textContent.trim();

        if (name && !members.includes(name)) {
            members.push(name);
            permissions.push(perm);
            renderMembersList();
            meminput.value = '';
            meminput.focus();
        }
    }

    function removeMember(name) {
        const index = members.indexOf(name);
        if (index !== -1) {
            members.splice(index, 1);
            permissions.splice(index, 1);
            renderMembersList();
        }
    }

    function renderMembersList() {
        const container = document.getElementById('membersList');
        container.innerHTML = '';

        members.forEach(name => {
            const badge = document.createElement('span');
            badge.className = 'badge d-flex align-items-center';
            badge.style = 'background:rgb(30, 18, 82);'
            badge.innerHTML = `
                ${name}
                <button type="button" class="btn-close btn-close-white ms-2" aria-label="Remove" data-name="${name}"></button>
            `;
            container.appendChild(badge);

            // Add event listener to remove button
            badge.querySelector('button').addEventListener('click', () => removeMember(name));
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
            success: function (response) {
                // Display the success flash message
                const flashHTML = `
                <div class="alert alert-dismissible fade show" role="alert"
                    style="background-color:white; color:black; padding:10px; margin-right:5px;" id="group-sub-success">
                    <i class="bx bx-check-circle" style="color:lawngreen;"></i>
                    Successfully Created Group
                </div>`;
                const flashElement = document.body.insertAdjacentHTML('beforeend', flashHTML);

                // Auto-remove after  seconds
                setTimeout(function () {
                    const flashElement = document.getElementById('group-sub-success');
                    flashElement.style.opacity = '0';
                    setTimeout(function () {
                        flashElement.remove();
                    }, 2000);
                }, 1000);
            },
            error: function (response) {
                alert('Group Form Submission error');
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