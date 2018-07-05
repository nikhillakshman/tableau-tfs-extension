'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {

    $(document).ready(function () {

        tableau.extensions.initializeDialogAsync().then(() => {
            //Register the getMarkData to MarkSelectionChanged Listener for all the workSheets
            let worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;
            worksheets.forEach((worksheet) => {
                worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, event => getMarkData(event));
            });
        });

        $('#save').click(() => {
            let changes = {};
            changes['assigned'] = $('#assigned').select2('data')[0].text;
            changes['state'] = $('#state').select2('data')[0].text;
            changes['comment'] = $('#comment').val();
            update(changes);
        });

        $('#state').select2();

        $('#assigned').select2({
            ajax: {
                url: 'https://tfs.tsi.lan/tfs/DefaultCollection/_apis/IdentityPicker/Identities?api-version=1.0',
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                data: function (param) {
                    return '{"query":"' + param.term + '","identityTypes":["user","group"],"operationScopes":["ims"],"properties":["DisplayName","IsMru","ScopeName","SamAccountName","Active","Department","JobTitle","Mail","MailNickname","PhysicalDeliveryOfficeName","SignInAddress","Surname","Guest","Description"],"filterByAncestorEntityIds":["vss.ds.v1.ims.group.d1dbe8746e804529b79c76e61d778d07"],"filterByEntityIds":[],"options":{"MinResults":40,"MaxResults":40}}';
                },
                processResults: function (data) {
                    let result = {
                        results: []
                    };
                    for (let i = 0; i < data.results[0].identities.length; i++) {
                        result.results[i] = {
                            "id": i,
                            "text": data.results[0].identities[i].displayName
                        }
                    }
                    return result;
                }
            }
        });
    });

    function getMarkData(event) {
        event.getMarksAsync().then((mark) => {

            if (mark === undefined || mark.data === undefined || mark.data.length !== 1 || mark.data[0].columns === undefined) {
                resetExtension();
                return;
            }

            let j = -1;
            for (let i = 0; i < mark.data[0].columns.length; i++) {
                if (mark.data[0].columns[i].fieldName === "Work Item ID") {
                    j = i;
                    break;
                }
            }

            // Return if no Work Item ID field found
            if (j === -1) {
                resetExtension();
                return;
            }

            let id = mark.data[0].data[0][j].value;

            $.ajax({
                url: "https://tfs.tsi.lan/tfs/DefaultCollection/_apis/wit/workitems/" + id + "?api-version=2.0",
                dataType: 'json',
                Connection: 'keep-alive',
                beforeSend: function (xhr) {
                    xhr.withCredentials = true;
                },
                crossDomain: true
            }).then(function (data) {
                let title = data.fields["System.Title"];
                let state = data.fields["System.State"];
                let des = data.fields["System.Description"];
                let assigned = formatAssignedTo(data.fields["System.AssignedTo"]);

                $('#wii').text(" " + data.id);
                $('#title').text(" " + title);
                $('#description').text(" " + des);

                $('#state').val(state);
                $('#state').trigger('change');

                //reset and then set assigned Dropdown
                $('#assigned').val(null).trigger('change');
                let newOption = new Option(assigned, 1, true, true);
                $('#assigned').append(newOption).trigger('change');
                resetComments();
                disableSave();
            }, function (error) {
                alert("TFS Extension: Something went wrong");
            });
        });
    }
    function disableSave() {
        $('#save').di
    }
    function resetExtension() {
        $('#wii').text(' ' + '???');
        $('#title').text(' ' + '???');
        $('#description').text(' ' + '???');

        $('#state').val('');
        $('#state').trigger('change');

        $('#assigned').val(null).trigger('change');
        resetComments();
    }

    function update(changedValues) {
        let updateValue;
        if (changedValues['comment'] !== undefined && changedValues['comment'] !== "") {
            updateValue = JSON.stringify([{
                "op": "add",
                "path": "/fields/System.AssignedTo",
                "value": changedValues['assigned']
            }, {
                "op": "add",
                "path": "/fields/System.State",
                "value": changedValues['state']
            }, {
                "op": "add",
                "path": "/fields/System.History",
                "value": changedValues['comment']
            }]);
        } else {
            updateValue = JSON.stringify([{
                "op": "add",
                "path": "/fields/System.AssignedTo",
                "value": assignedTo
            }, {
                "op": "add",
                "path": "/fields/System.State",
                "value": state
            }]);
        }

        let id = $('#wii').text().trim();
        if (id === undefined || id === "")
            return;

        $.ajax({
            url: "https://tfs.tsi.lan/tfs/DefaultCollection/_apis/wit/workitems/" + id + "?api-version=2.0",
            dataType: 'json',
            type: 'PATCH',
            dataType: 'json',
            processData: false,
            contentType: 'application/json-patch+json',
            data: updateValue
        }).then(function (data) {
            resetComments();
            alert("TFS Extension: Success");
        }, function (error) {
            alert("TFS Extension: Something went wrong");
        });
    }

    function resetComments() {
        $('#comment').val(null);
    }

    function formatAssignedTo(assignedTo) {
        let index = assignedTo.indexOf('<');
        let formattedString = assignedTo;
        if (index > 0)
            formattedString = assignedTo.substr(0, index);

        return formattedString;
    }
})();