import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://proyecto-ugr-grezalito.aws-sa-east-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTQ0MTg0NDgsImlkIjoiMDFhMWNiYWMtNTAwMS03ZDg0LTgxODctYzUyMzFhM2EwNjU1Iiwia2lkIjoiY19CUURtZTVwOFhxTWI5b2plckVQd1VGbzZtd05DY2Ffdm9yTi1kM19jayIsInJpZCI6IjcxZjVhZjFmLThhZjQtNGI2ZC04NmY3LWNiYmZlZTc5YjVlOCJ9.d5mlMkKSoNUlJYgKO7olrTMzdpM8LqYmu70D6V8PlIBTy62rnLyaNrnsu7QKe8nCd2W-8jiJXBluiLq9UE6qCQ"
});

const productos = [
  ['p1', 'Yerba Mate Playadito 1kg', 'almacen', 480000, 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&auto=format&fit=crop'\],
  ['p2', 'Leche La Serenísima 1L', 'lacteos', 140000, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop'\],
  ['p3', 'Fideos Matarazzo 500g', 'almacen', 120000, 'https://images.unsplash.com/photo-1621996346565-e3d5d628169e?w=500&auto=format&fit=crop'\],
  ['p4', 'Gaseosa Coca-Cola 2.25L', 'bebidas', 310000, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop'\],
  ['p5', 'Aceite de Girasol 900ml', 'almacen', 210000, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop'\],
  ['p6', 'Arroz Lucchetti 1kg', 'almacen', 180000, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop'\],
  ['p7', 'Queso Cremoso La Paulina 500g', 'lacteos', 420000, 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=500&auto=format&fit=crop'\],
  ['p8', 'Yogur Firme Ilolay 190g', 'lacteos', 95000, 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=500&auto=format&fit=crop'\],
  ['p9', 'Agua Mineral Villavicencio 2L', 'bebidas', 150000, 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop'\],
  ['p10', 'Detergente Magistral 500ml', 'limpieza', 230000, 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=500&auto=format&fit=crop'\],
  ['p11', 'Lavandina Ayudín 1L', 'limpieza', 110000, 'https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?w=500&auto=format&fit=crop'\],
  ['p12', 'Jabón en Polvo Ala 800g', 'limpieza', 290000, 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=500&auto=format&fit=crop'\]
];

async function run() {
  console.log("Cargando 12 productos en Turso...");
  for (const p of productos) {
    await client.execute({
      sql: `INSERT INTO products (id, title, category_id, price, image) 
            VALUES (?, ?, ?, ?, ?) 
            ON CONFLICT(id) DO UPDATE SET title=excluded.title, price=excluded.price, image=excluded.image;`,
      args: p
    });
  }
  console.log("¡12 productos cargados y sincronizados con éxito!");
}

run().catch(console.error);
