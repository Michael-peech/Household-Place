from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
from typing import Dict
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "shop.db"

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                stock INTEGER NOT NULL,
                cost_price INTEGER NOT NULL,
                category TEXT NOT NULL,
                tags TEXT,
                image_data TEXT
            )
        ''')
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                total_amount INTEGER NOT NULL,
                payment_method TEXT NOT NULL
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS transaction_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price_sold_at INTEGER NOT NULL,
                cost_price INTEGER NOT NULL,
                FOREIGN KEY(transaction_id) REFERENCES transactions(id)
            )
        ''')
        
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

init_db()

# --- Models ---
class CartItem(BaseModel):
    quantity: int
    price: int  

class CartPayload(BaseModel):
    payment_method: str
    items: Dict[int, CartItem]

class ProductPayload(BaseModel):
    name: str
    price: int
    stock: int
    cost_price: int
    category: str
    tags: str
    image_data: str

# --- API Endpoints ---

@app.get("/api/products")
def get_products():
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM products")
        return [dict(row) for row in c.fetchall()]

@app.post("/api/products")
def add_product(product: ProductPayload):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("INSERT INTO products (name, price, stock, cost_price, category, tags, image_data) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                  (product.name, product.price, product.stock, product.cost_price, product.category, product.tags, product.image_data))
        conn.commit()
    return {"status": "success"}

@app.put("/api/products/{product_id}")
def update_product(product_id: int, product: ProductPayload):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("UPDATE products SET name = ?, price = ?, stock = ?, cost_price = ?, category = ?, tags = ?, image_data = ? WHERE id = ?",
                  (product.name, product.price, product.stock, product.cost_price, product.category, product.tags, product.image_data, product_id))
        conn.commit()
    return {"status": "success"}

# NEW: Delete product endpoint
@app.delete("/api/products/{product_id}")
def delete_product(product_id: int):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        c.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
    return {"status": "success"}

@app.post("/api/checkout")
def checkout(payload: CartPayload):
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        
        total_amount = sum(item.price * item.quantity for item in payload.items.values())
        timestamp = datetime.now().isoformat()
        
        c.execute("INSERT INTO transactions (timestamp, total_amount, payment_method) VALUES (?, ?, ?)",
                  (timestamp, total_amount, payload.payment_method))
        transaction_id = c.lastrowid
        
        for product_id, item in payload.items.items():
            c.execute("SELECT name, cost_price, stock FROM products WHERE id = ?", (product_id,))
            product_row = c.fetchone()
            
            if not product_row:
                raise HTTPException(status_code=400, detail=f"Product {product_id} not found")
            
            product_name, cost_price, current_stock = product_row
            
            if current_stock < item.quantity:
                raise HTTPException(status_code=400, detail=f"Not enough stock for {product_name}")
            
            c.execute("UPDATE products SET stock = stock - ? WHERE id = ?", (item.quantity, product_id))
            
            c.execute("""
                INSERT INTO transaction_items 
                (transaction_id, product_id, product_name, quantity, price_sold_at, cost_price) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (transaction_id, product_id, product_name, item.quantity, item.price, cost_price))
            
        conn.commit()
    return {"status": "success", "transaction_id": transaction_id}

@app.get("/api/reports/sales")
def get_sales_report():
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute("SELECT * FROM transactions ORDER BY timestamp DESC")
        transactions = [dict(row) for row in c.fetchall()]
        
        for tx in transactions:
            c.execute("SELECT * FROM transaction_items WHERE transaction_id = ?", (tx['id'],))
            tx['items'] = [dict(row) for row in c.fetchall()]
            
        return transactions