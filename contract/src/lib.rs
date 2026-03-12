#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, Vec, BytesN,
};

// ── Grid dimensions ────────────────────────────────────────────────────────
const GRID_W: u32 = 32;
const GRID_H: u32 = 32;
const TOTAL_PIXELS: u32 = GRID_W * GRID_H; // 1024

// ── Types ──────────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct Pixel {
    pub owner: Address,
    pub color: u32,   // 0xRRGGBB packed
    pub painted_at: u64,
    pub paint_count: u32, // how many times this pixel was repainted
}

#[contracttype]
#[derive(Clone)]
pub struct PixelSummary {
    pub x: u32,
    pub y: u32,
    pub color: u32,
    pub owner: Address,
}

#[contracttype]
pub enum DataKey {
    Pixel(u32, u32),   // (x, y) → Pixel
    PaintedCount,       // total unique painted pixels
    TotalPaints,        // total paint operations (including repaints)
}

#[contract]
pub struct PixelStakeContract;

#[contractimpl]
impl PixelStakeContract {
    /// Paint a pixel at (x, y) with an RGB color (0xRRGGBB).
    /// Painter must sign — this is the on-chain proof of ownership.
    pub fn paint_pixel(
        env: Env,
        painter: Address,
        x: u32,
        y: u32,
        color: u32,
    ) {
        painter.require_auth();

        assert!(x < GRID_W, "x out of bounds");
        assert!(y < GRID_H, "y out of bounds");
        assert!(color <= 0xFFFFFF, "color must be 0xRRGGBB");

        let key = DataKey::Pixel(x, y);
        let was_blank = !env.storage().persistent().has(&key);

        // Count repaint
        let paint_count = if was_blank {
            1u32
        } else {
            let existing: Pixel = env.storage().persistent().get(&key).unwrap();
            existing.paint_count + 1
        };

        let pixel = Pixel {
            owner: painter.clone(),
            color,
            painted_at: env.ledger().timestamp(),
            paint_count,
        };

        env.storage().persistent().set(&key, &pixel);

        // Bump counters
        if was_blank {
            let count: u32 = env
                .storage()
                .instance()
                .get(&DataKey::PaintedCount)
                .unwrap_or(0u32);
            env.storage()
                .instance()
                .set(&DataKey::PaintedCount, &(count + 1));
        }

        let total: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalPaints)
            .unwrap_or(0u32);
        env.storage()
            .instance()
            .set(&DataKey::TotalPaints, &(total + 1));

        env.events().publish(
            (symbol_short!("painted"),),
            (x, y, color, painter),
        );
    }

    /// Get a single pixel by coordinates
    pub fn get_pixel(env: Env, x: u32, y: u32) -> Option<Pixel> {
        assert!(x < GRID_W, "x out of bounds");
        assert!(y < GRID_H, "y out of bounds");
        env.storage().persistent().get(&DataKey::Pixel(x, y))
    }

    /// Batch-read a rectangular region: returns flat Vec of colors (0 = unpainted)
    /// Max region is 16x16 to stay within budget
    pub fn get_region(
        env: Env,
        x_start: u32,
        y_start: u32,
        w: u32,
        h: u32,
    ) -> Vec<u32> {
        assert!(w <= 16 && h <= 16, "region too large, max 16x16");
        assert!(x_start + w <= GRID_W, "region out of bounds");
        assert!(y_start + h <= GRID_H, "region out of bounds");

        let mut result: Vec<u32> = Vec::new(&env);
        for row in y_start..(y_start + h) {
            for col in x_start..(x_start + w) {
                let color = env
                    .storage()
                    .persistent()
                    .get::<DataKey, Pixel>(&DataKey::Pixel(col, row))
                    .map(|p| p.color)
                    .unwrap_or(0u32);
                result.push_back(color);
            }
        }
        result
    }

    /// How many unique pixels have been painted
    pub fn painted_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::PaintedCount)
            .unwrap_or(0u32)
    }

    /// Total paint operations ever
    pub fn total_paints(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalPaints)
            .unwrap_or(0u32)
    }

    /// Grid dimensions
    pub fn grid_size(_env: Env) -> (u32, u32) {
        (GRID_W, GRID_H)
    }
}
