import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

let wss: WebSocketServer;
const clients = new Set<WebSocket>();

/**
 * Initialize WebSocket server attached to the HTTP server
 */
export function initWebSocket(server: HttpServer): void {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws: WebSocket) => {
        console.log('WebSocket client connected. Total clients:', clients.size + 1);
        clients.add(ws);

        // Send welcome message
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to KAIRO WebSocket server',
            timestamp: Date.now(),
        }));

        ws.on('message', (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());
                handleClientMessage(ws, message);
            } catch {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
            }
        });

        ws.on('close', () => {
            clients.delete(ws);
            console.log('WebSocket client disconnected. Total clients:', clients.size);
        });

        ws.on('error', (err) => {
            console.error('WebSocket client error:', err);
            clients.delete(ws);
        });
    });

    console.log('WebSocket server initialized on /ws');
}

/**
 * Handle incoming client messages
 */
function handleClientMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
        case 'subscribe':
            // TODO: Implement channel subscriptions (e.g., subscribe to specific user events)
            ws.send(JSON.stringify({ type: 'subscribed', channel: message.channel }));
            break;
        default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
}

/**
 * Broadcast a message to all connected clients
 */
function broadcast(data: object): void {
    const payload = JSON.stringify(data);
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

/**
 * Broadcast a price update to all clients
 */
export function broadcastPriceUpdate(priceData: {
    price: string;
    totalSupply: string;
    totalBurned: string;
}): void {
    broadcast({
        type: 'priceUpdate',
        data: priceData,
        timestamp: Date.now(),
    });
}

/**
 * Broadcast a compound event to all clients
 */
export function broadcastCompoundEvent(compoundData: {
    user: string;
    stakeId: string;
    profit: string;
    newAmount: string;
}): void {
    broadcast({
        type: 'compoundEvent',
        data: compoundData,
        timestamp: Date.now(),
    });
}

/**
 * Broadcast an order book update to all clients
 */
export function broadcastOrderBookUpdate(orderData: Record<string, any>): void {
    broadcast({
        type: 'orderBookUpdate',
        data: orderData,
        timestamp: Date.now(),
    });
}

/**
 * Get the number of connected clients
 */
export function getConnectedClients(): number {
    return clients.size;
}
