$(document).ready(function(){
    var socket;
    var symmetric_key;
    
    var path = window.location.pathname;
    var chat_id = path.substring(6, path.length);
    
    // Scroll to bottom
    $("#chat_base").scrollTop($("#chat_base")[0].scrollHeight);
    

    // Click 'Search!' button when 'Enter' key is pressed
    $("#search_text").keyup(function(event){
        if(event.keyCode == 13){
            $("#search_keyword").click();
        }
    });
    // Handle Search
    $('#search_keyword').click(function() {
        var keyword = $('#search_text').val().toLowerCase();
        
        if (!symmetric_key) {
            computeSymmetricKey();
        }
        
        var token = tokenize(symmetric_key, keyword);
        var count = JSON.parse(sessionStorage.getItem(CURRENT_USERNAME))['keyword-' + chat_id + "-" + keyword];
        var req_data = {
            "token" : token, 
            "count" : count
        }; 
        
        var search_path = $SCRIPT_ROOT + path + '/search';
        
        // Send search request
        $.post(search_path, req_data, function(data) {
            if (data.error) {
                $('#search_text').val('');
                alert(data.error);
                return;
            }
            // Redirect to search result page
            window.location.href = search_path;
        });
        
    });

    socket = io.connect('https://' + document.domain + ':' + location.port + '/chat');
    socket.on('connect', function() {
        socket.emit('joined', {});
    });
    // Display new message
    socket.on('message', function(data) {
        var msg_id = data['id'];
        var msg = data['msg'];
        var sender = data['sender'];
        var receiver = data['receiver'];
        var dt = data['dt'];
        
        if (!symmetric_key) {
            computeSymmetricKey();
        }
        msg = sjcl.decrypt(symmetric_key, msg);
        
        if (CURRENT_USERNAME == sender) {
            // Message processing for search protocol
            // Do update pairs
            processNewMessage(msg_id, msg, true);
            $("#chat_base").append(newSenderMessage(msg, sender, dt));
        }
        else if (CURRENT_USERNAME == receiver) {
            // Message processing for search protocol
            processNewMessage(msg_id, msg, false);
            $("#chat_base").append(newReceiverMessage(msg, sender, dt));
        }
        // Scroll to bottom
        $("#chat_base").scrollTop($("#chat_base")[0].scrollHeight);
    });

    // Click 'Send' button when 'Enter' key is pressed
    $("#message").keyup(function(event){
        if(event.keyCode == 13){
            $("#send_message").click();
        }
    });
    // Send new message to server when 'Send' button is clicked
    $("#send_message").click(function() {
        var message = $('#message').val();
        // Clear message box
        $('#message').val('');
        if (message === '') {
            // Empty message, do not send
            return;
        }
        if (message.length > 250) {
            // Unencrypted message must be at most 250 characters
            return;
        }
        if (!symmetric_key) {
            computeSymmetricKey();
        }
        var message = sjcl.encrypt(symmetric_key, message);

        // Send message to server
        socket.emit('new_message', {msg: message});
    });
    // Disconnect socket and go to home page when 'Leave Chat' button is clicked
    $('#leaveChat').click(function (url) {
        socket.emit('left', {}, function() {
            socket.disconnect();
            // Go back to the login page
            window.location.href = "/";
        });
    });

    $(".text-warning").each(function(index, element) {
        if (!symmetric_key) {
            computeSymmetricKey();
        }
        var enc_message = $(this).text();
        var decrypted_msg = sjcl.decrypt(symmetric_key, enc_message);
        $(this).text(decrypted_msg);
        
        // Process new messages
        var message_id = parseInt($(this).attr('data-id'));
        processNewMessage(message_id, decrypted_msg, false);
    });

    function computeSymmetricKey() {
        var serialized_sk = JSON.parse(sessionStorage.getItem(CURRENT_USERNAME))["secret_key"];
        // Unserialized private key:
        var unserialized_sk = new sjcl.ecc.elGamal.secretKey(
            sjcl.ecc.curves.c256,
            sjcl.ecc.curves.c256.field.fromBits(sjcl.codec.base64.toBits(serialized_sk))
        );
        symmetric_key = sjcl.decrypt(unserialized_sk, ENCRYPTED_SYM_KEY);
    }
    
    /**
     * Checks if message has been processed before and processes if not.
     * @param {integer} message_id The identifier for a message.
     * @param {string} message The message to be processed.
     * @param {boolean} update_pairs whether or not pairs should be updated
     * @return {boolean} Returns a boolean of whether or not the message was processed.
     */
    function processNewMessage(message_id, message, update_pairs) {
        var message_key = "message-" + message_id.toString();
        var processed_id = JSON.parse(sessionStorage.getItem(CURRENT_USERNAME))[message_key];
        if (processed_id != null) {
            return false;
        } else {
            processMessage(symmetric_key, message_id, message, chat_id, update_pairs);
            var user_data = JSON.parse(sessionStorage.getItem(CURRENT_USERNAME));
            user_data[message_key] = "processed";
            sessionStorage.setItem(CURRENT_USERNAME, JSON.stringify(user_data));
        }
        return true;
    }

    function newSenderMessage(msg, username, dt) {
        return $('<div/>', {'class': 'row msg_container base_sent'}).append(
                    $('<div/>', {'class': 'col-md-10 col-xs-10'}).append(
                        $('<div/>', {'class': 'messages msg_sent'}).append(
                            $('<p/>', {'class': 'text-warning', 'text': msg})
                        ).append(
                            $('<time/>', {'class': '', 'datetime': dt, 'text': username + '•' + dt})
                        )
                    )
                ).append(
                    $('<div/>', {'class': 'col-md-2 col-xs-2 avatar'}).append(
                        $('<img/>', {'src': 'https://secure.gravatar.com/avatar/00000000000000000000000000000000?d=retro', 'height': '100', 'width': '100', 'class': 'img-responsive'})
                    )
                );
    };

    function newReceiverMessage(msg, username, dt) {
        return $('<div/>', {'class': 'row msg_container base_receive'}).append(
                    $('<div/>', {'class': 'col-md-2 col-xs-2 avatar'}).append(
                        $('<img/>', {'src': 'https://secure.gravatar.com/avatar/00000000000000000000000000000000?d=retro', 'height': '100', 'width': '100', 'class': 'img-responsive'})
                    )
                ).append(
                    $('<div/>', {'class': 'col-md-10 col-xs-10'}).append(
                        $('<div/>', {'class': 'messages msg_sent'}).append(
                            $('<p/>', {'class': 'text-warning', 'text': msg})
                        ).append(
                            $('<time/>', {'class': '', 'datetime': dt, 'text': username + '•' + dt})
                        )
                    )
                );
    };
});