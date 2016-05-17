// Useful format function
if (!String.format) {
  String.format = function(format) {
    var args = Array.prototype.slice.call(arguments, 1);
    return format.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number] 
        : match
      ;
    });
  };
}

$(document).ready(function(){
    // Scroll to bottom
    $("#chat_base").scrollTop($("#chat_base")[0].scrollHeight);

    var socket;
    var symmetric_key;

    socket = io.connect('http://' + document.domain + ':' + location.port + '/chat');
    socket.on('connect', function() {
        socket.emit('joined', {});
    });
    // Status message when user enter/leaves chat
    socket.on('status', function(data) {
        alert(data['msg']);
    });
    // Display new message
    socket.on('message', function(data) {
        var msg = data['msg'];
        var sender = data['sender'];
        var receiver = data['receiver'];
        var dt = data['dt'];
        
        if (!symmetric_key) {
            computeSymmetricKey();
        }
        msg = sjcl.decrypt(symmetric_key, msg);
        
        if (CURRENT_USERNAME == sender) {
            $("#chat_base").append(newSenderMessage(msg, sender, dt));
        }
        if (CURRENT_USERNAME == receiver) {
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
        message_id_str = $(this).attr('data-id');
        message_id = parseInt(message_id);
        message_key = "message-"+message_id_str;
        processed_id = localStorage.getItem(message_key);
        if (processed_id == null){
            processMessage(symmetric_key, message_id, decrypted_msg);
            localStorage.setItem(message_key, "processed");
        }
    });

    function computeSymmetricKey() {
        serialized_sk = localStorage.getItem(CURRENT_USERNAME + "_secret_key");
        // Unserialized private key:
        unserialized_sk = new sjcl.ecc.elGamal.secretKey(
            sjcl.ecc.curves.c256,
            sjcl.ecc.curves.c256.field.fromBits(sjcl.codec.base64.toBits(serialized_sk))
        );
        symmetric_key = sjcl.decrypt(unserialized_sk, ENCRYPTED_SYM_KEY);
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