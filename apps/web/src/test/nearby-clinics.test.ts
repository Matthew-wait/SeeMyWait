import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchNearbyPage, fetchNearbyBatch, nearbyCountLabel, loadAllNearbyPages, mergeNearbyPages, NearbyRow } from "@/lib/nearby-clinics";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const row = (id: string, distance: number) => ({ id, distance_miles: distance } as NearbyRow);
beforeEach(() => rpc.mockReset());

describe("manual nearby batches", () => {
  it("requests exactly one 1,000-entry batch without following its cursor", async () => {
    rpc.mockResolvedValue({data:{clinics:Array.from({length:1000},(_,i)=>row(String(i),i/1000)),next_cursor:{distance:1,id:"last"}}});
    const batch = await fetchNearbyBatch(1,2,5,null);
    expect(batch.clinics).toHaveLength(1000);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]).toEqual(["nearby_clinics_batch",{p_lat:1,p_lng:2,p_radius_miles:5,p_page_size:1000,p_after_distance:undefined,p_after_id:undefined}]);
  });
  it("uses the last exact distance and ID for the next requested batch", async () => {
    rpc.mockResolvedValue({data:{clinics:[row("next",1)],next_cursor:null}});
    await fetchNearbyBatch(1,2,5,{distance:0,id:"previous"});
    expect(rpc.mock.calls[0][1]).toMatchObject({p_after_distance:0,p_after_id:"previous"});
  });
  it("shows the exact completed count and a plus only while more exist", () => {
    expect(nearbyCountLabel(26,false)).toBe("26");
    expect(nearbyCountLabel(1000,true)).toBe("1,000+");
    expect(nearbyCountLabel(1000,false)).toBe("1,000");
    expect(nearbyCountLabel(2000,true)).toBe("2,000+");
  });
});
describe("uncapped nearby loading", () => {
  it("continues past 500 and empty sections until the server's final cursor", async () => {
    rpc.mockResolvedValueOnce({ data: { clinics: Array.from({length:500},(_,i)=>row(String(i),i/100)), next_cursor: {cell:0,id:"last"} } })
      .mockResolvedValueOnce({ data: { clinics: [], next_cursor: {cell:8,id:null} } })
      .mockResolvedValueOnce({ data: { clinics: [row("501",20),row("502",25)], next_cursor:null } });
    const all = await loadAllNearbyPages(25.8965,-80.157,25);
    expect(all).toHaveLength(502);
    expect(all.at(-1)?.distance_miles).toBe(25);
    expect(rpc.mock.calls[2][1]).toMatchObject({p_cell:8,p_after_id:undefined,p_radius_miles:25});
  });
  it("deduplicates the initial preview and sorts exact distance, including zero", () => {
    const merged = mergeNearbyPages([{clinics:[row("a",0),row("b",9)],next_cursor:null},
      {clinics:[row("b",9),row("c",1),row("d",0)],next_cursor:null}]);
    expect(merged.map(r=>r.id)).toEqual(["a","d","c","b"]);
  });
  it("retries a timed-out page at a smaller size without advancing its cursor", async () => {
    rpc.mockResolvedValueOnce({error:{code:"57014"}})
      .mockResolvedValueOnce({data:{clinics:[row("a",1)],next_cursor:null}});
    await fetchNearbyPage(1,2,25,{cell:3,id:"saved"});
    expect(rpc.mock.calls.map(c=>c[1].p_page_size)).toEqual([1000,250]);
    expect(rpc.mock.calls[1][1]).toMatchObject({p_cell:3,p_after_id:"saved"});
  });
  it("rejects a repeated cursor instead of fetching forever", async () => {
    rpc.mockResolvedValue({data:{clinics:[],next_cursor:{cell:2,id:null}}});
    await expect(fetchNearbyPage(1,2,25,{cell:2,id:null})).rejects.toThrow("did not advance");
  });
  it("does not silently turn a failed page into a complete list", async () => {
    rpc.mockResolvedValue({error:{code:"42501",message:"denied"}});
    await expect(loadAllNearbyPages(1,2,25)).rejects.toMatchObject({code:"42501"});
  });
});
