/* eslint-disable react-refresh/only-export-components -- isolated executable fixture */
import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SystemNotice } from "@/components/system/SystemNotice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "@/styles.css";
import "./fixture.css";

const query = new URLSearchParams(location.search);
const theme = query.get("theme") === "light" ? "light" : "dark";
document.documentElement.className = theme;
document.documentElement.style.colorScheme = theme;

function Controls() {
  const [submissions, setSubmissions] = useState(0);
  const [selected, setSelected] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  return (
    <main className="control-fixture">
      <header>
        <p>SYNTHETIC UI ACCEPTANCE · NO ACCOUNT DATA</p>
        <h1>One control language.</h1>
        <p>Real GYMS.LIFE controls. Local interactions only; nothing is saved to a server.</p>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmissions((count) => count + 1);
        }}
      >
        <label htmlFor="amount">Amount</label>
        <Input ref={field} id="amount" name="amount" inputMode="decimal" placeholder="0.0" />
        <label htmlFor="notes">Notes</label>
        <Textarea id="notes" rows={3} placeholder="Your next step" />
        <div className="control-fixture-grid">
          <Button type="submit">Sukurti mano individualų treniruočių planą</Button>
          <Button type="button" variant="outline" onClick={() => field.current?.focus()}>
            Focus amount
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={selected}
            onClick={() => setSelected((value) => !value)}
          >
            Select mode
          </Button>
          <Button type="button" variant="secondary" disabled onClick={() => setSubmissions(999)}>
            Unavailable action
          </Button>
          <Button asChild variant="link">
            <a href="#details">Open details</a>
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Open instrument">
            <ArrowUpRight aria-hidden="true" />
          </Button>
        </div>
        <output aria-label="Local submissions">{submissions}</output>
        <label htmlFor="invalid">Explicit validation state</label>
        <Input id="invalid" aria-invalid="true" aria-describedby="field-error" defaultValue="?" />
        <p id="field-error">Synthetic validation message. This is not health advice.</p>
        <label htmlFor="read-only">Read-only value</label>
        <Input id="read-only" readOnly defaultValue="Reference only" />
      </form>
      <div id="details">
        <SystemNotice eyebrow="UI TEST" title="Clear state. One next step.">
          Theme-aware text and keyboard controls without simulated telemetry.
        </SystemNotice>
      </div>
      <section aria-label="Portal and navigation controls">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Review session</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Session details</DialogTitle>
              <DialogDescription>
                Local synthetic content for narrow screens and keyboard navigation.
              </DialogDescription>
            </DialogHeader>
            {Array.from({ length: 20 }, (_, i) => (
              <p key={i}>
                Exercise {i + 1}. Your recorded sets and technique notes remain readable inside the
                scrollable dialog.
              </p>
            ))}
            <Button variant="outline">Last detail action</Button>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Session settings</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle>Session settings</SheetTitle>
            <SheetDescription>Adjust your local view.</SheetDescription>
            <label htmlFor="sheet-note">Session note</label>
            <Input id="sheet-note" />
          </SheetContent>
        </Sheet>
        <Select defaultValue="strength">
          <SelectTrigger aria-label="Training focus">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="strength">Strength</SelectItem>
            <SelectItem value="endurance">Endurance</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">More actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setSelected(true)}>
              Select this session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Read explanation</Button>
          </PopoverTrigger>
          <PopoverContent>
            Based on your saved entries. Unknown values remain unknown.
          </PopoverContent>
        </Popover>
        <Tabs defaultValue="overview">
          <TabsList aria-label="Detail sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Session overview</TabsContent>
          <TabsContent value="history">Saved session history</TabsContent>
        </Tabs>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Controls />
  </StrictMode>,
);
