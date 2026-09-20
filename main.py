from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Absolute pathing prevents PythonAnywhere folder permission locks
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "shop.db")

def init_db():
    with sqlite3.connect(DB_NAME, timeout=5) as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL, cost_price INTEGER NOT NULL, category TEXT NOT NULL, tags TEXT, image_data TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL, total_amount INTEGER NOT NULL, payment_method TEXT NOT NULL)''')
        c.execute('''CREATE TABLE IF NOT EXISTS transaction_items (id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity INTEGER NOT NULL, price_sold_at INTEGER NOT NULL, cost_price INTEGER NOT NULL, FOREIGN KEY(transaction_id) REFERENCES transactions(id))''')
        
        c.execute("SELECT COUNT(*) FROM products")
        if c.fetchone()[0] == 0:
            sample_products = [
                ("Peak Milk Powder 400g", 3500, 24, 3000, "Provisions", "grocery, everyday", ""),
                ("Golden Penny Spaghetti", 800, 50, 650, "Provisions", "grocery, pasta", ""),
                ("Electric Air Fryer", 45000, 5, 38000, "Appliances", "electricals, heavy", ""),
                ("Food Flask (Large)", 7000, 15, 5500, "Plastics & Flasks", "fragile", "")
            ]
            c.executemany("INSERT INTO products (name, price, stock, cost_price, category, tags, image_data) VALUES (?, ?, ?, ?, ?, ?, ?)", sample_products)
        conn.commit()

db_initialized = False

def get_db():
    global db_initialized
    if not db_initialized:
        init_db()
        db_initialized = True
    return sqlite3.connect(DB_NAME, timeout=5)

@app.route("/", methods=["GET"])
def read_root():
    return jsonify({"status": "Backend is ALIVE and running natively on Flask!"})

@app.route("/api/products", methods=["GET"])
def get_products():
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM products")
        return jsonify([dict(row) for row in c.fetchall()])

@app.route("/api/products", methods=["POST"])
def add_product():
    product = request.json
    with get_db() as conn:
        c = conn.cursor()
        c.execute("INSERT INTO products (name, price, stock, cost_price, category, tags, image_data) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                  (product['name'], product['price'], product['stock'], product['cost_price'], product.get('category', ''), product.get('tags', ''), product.get('image_data', '')))
        conn.commit()
    return jsonify({"status": "success"})

@app.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    product = request.json
    with get_db() as conn:
        c = conn.cursor()
        c.execute("UPDATE products SET name = ?, price = ?, stock = ?, cost_price = ?, category = ?, tags = ?, image_data = ? WHERE id = ?",
                  (product['name'], product['price'], product['stock'], product['cost_price'], product.get('category', ''), product.get('tags', ''), product.get('image_data', ''), product_id))
        conn.commit()
    return jsonify({"status": "success"})

@app.route("/api/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    with get_db() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
    return jsonify({"status": "success"})

@app.route("/api/checkout", methods=["POST"])
def checkout():
    payload = request.json
    with get_db() as conn:
        c = conn.cursor()
        
        items = payload.get('items', {})
        total_amount = sum(item['price'] * item['quantity'] for item in items.values())
        timestamp = datetime.now().isoformat()
        
        c.execute("INSERT INTO transactions (timestamp, total_amount, payment_method) VALUES (?, ?, ?)",
                  (timestamp, total_amount, payload.get('payment_method')))
        transaction_id = c.lastrowid
        
        for product_id_str, item in items.items():
            product_id = int(product_id_str)
            c.execute("SELECT name, cost_price, stock FROM products WHERE id = ?", (product_id,))
            product_row = c.fetchone()
            
            if not product_row:
                return jsonify({"detail": f"Product {product_id} not found"}), 400
            
            product_name, cost_price, current_stock = product_row
            
            if current_stock < item['quantity']:
                return jsonify({"detail": f"Not enough stock for {product_name}"}), 400
            
            c.execute("UPDATE products SET stock = stock - ? WHERE id = ?", (item['quantity'], product_id))
            
            c.execute("""
                INSERT INTO transaction_items 
                (transaction_id, product_id, product_name, quantity, price_sold_at, cost_price) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (transaction_id, product_id, product_name, item['quantity'], item['price'], cost_price))
            
        conn.commit()
    return jsonify({"status": "success", "transaction_id": transaction_id})

@app.route("/api/reports/sales", methods=["GET"])
def get_sales_report():
    with get_db() as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute("SELECT * FROM transactions ORDER BY timestamp DESC")
        transactions = [dict(row) for row in c.fetchall()]
        
        for tx in transactions:
            c.execute("SELECT * FROM transaction_items WHERE transaction_id = ?", (tx['id'],))
            tx['items'] = [dict(row) for row in c.fetchall()]
            
        return jsonify(transactions)
