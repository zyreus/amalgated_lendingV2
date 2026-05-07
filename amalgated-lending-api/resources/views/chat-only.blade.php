<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Amalgated Lending Chat</title>
    <style>
        html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            font-family: Arial, sans-serif;
            background: #f5f7fb;
        }
        .chat-shell {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        .chat-header {
            padding: 12px 16px;
            background: #111827;
            color: #fff;
            font-weight: 600;
            font-size: 14px;
        }
        .chat-frame {
            border: 0;
            width: 100%;
            height: 100%;
            background: #fff;
        }
    </style>
</head>
<body>
<main class="chat-shell">
    <div class="chat-header">Amalgated Lending — Chat / CRM</div>
    <iframe
        class="chat-frame"
        src="{{ env('CHAT_CRM_PATH', '/admin/chat-crm') }}"
        title="Amalgated Lending Chat CRM"
    ></iframe>
</main>
</body>
</html>
