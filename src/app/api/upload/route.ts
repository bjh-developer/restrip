import { NextRequest, NextResponse } from 'next/server';

// Upload to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    // TODO: Implement Supabase storage upload
    return NextResponse.json({ message: 'Upload endpoint' }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
