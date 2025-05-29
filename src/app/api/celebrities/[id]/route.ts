import { NextRequest, NextResponse } from 'next/server';

// Force dynamic route handling
export const dynamic = 'force-dynamic';

/**
 * GET /api/celebrities/[id] - Get celebrity by ID or slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    {
      success: false,
      error: 'Not implemented',
    },
    { status: 501 }
  );
}

/**
 * PUT /api/celebrities/[id] - Update celebrity (Admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    {
      success: false,
      error: 'Not implemented',
    },
    { status: 501 }
  );
}

/**
 * DELETE /api/celebrities/[id] - Delete celebrity (Admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    {
      success: false,
      error: 'Not implemented',
    },
    { status: 501 }
  );
}
