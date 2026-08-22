<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$input = file_get_contents('php://input');
$payload = json_decode($input, true);

if (!$payload) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$amount = isset($payload['amount']) ? intval($payload['amount']) : 0;
if ($amount < 1 || $amount > 10000) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid amount']);
    exit;
}

$token = getenv('TELEGRAM_BOT_TOKEN');
if (empty($token) && file_exists(__DIR__ . '/secrets.php')) {
    include __DIR__ . '/secrets.php';
}
if (empty($token) && file_exists(__DIR__ . '/../secrets.php')) {
    include __DIR__ . '/../secrets.php';
}

if (empty($token)) {
    http_response_code(503);
    echo json_encode(['error' => 'TELEGRAM_BOT_TOKEN не настроен на сервере (задайте переменную окружения или создайте api/secrets.php)']);
    exit;
}

$url = "https://api.telegram.org/bot" . trim($token) . "/createInvoiceLink";
$data = [
    'title' => 'Поддержка проекта LezgiMez',
    'description' => "Добровольное пожертвование $amount ⭐️ на развитие LezgiMez",
    'payload' => "donation_" . $amount . "_stars_" . time(),
    'provider_token' => '',
    'currency' => 'XTR',
    'prices' => [
        ['label' => 'Stars', 'amount' => $amount]
    ]
];

$requestBody = json_encode($data);
$response = false;
$httpCode = 0;
$transportError = '';

if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $requestBody);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($response === false) {
        $transportError = curl_error($ch);
    }
    curl_close($ch);
} else {
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $requestBody,
            'timeout' => 10,
            'ignore_errors' => true
        ]
    ]);
    $response = @file_get_contents($url, false, $context);
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
        $httpCode = intval($matches[1]);
    }
    if ($response === false) {
        $transportError = 'HTTP streams недоступны на сервере';
    }
}

if (!$response) {
    http_response_code(502);
    echo json_encode(['error' => 'Не удалось связаться с Telegram Bot API' . ($transportError ? ': ' . $transportError : '')]);
    exit;
}

$resData = json_decode($response, true);
if (empty($resData['ok'])) {
    http_response_code(502);
    echo json_encode([
        'error' => 'Ошибка Telegram Bot API: ' . ($resData['description'] ?? 'неизвестно'),
        'httpCode' => $httpCode,
        'details' => $resData
    ]);
    exit;
}

echo json_encode(['ok' => true, 'invoiceLink' => $resData['result']]);
