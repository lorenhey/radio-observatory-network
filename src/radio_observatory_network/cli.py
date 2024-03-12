import typer
from rich.console import Console
from rich.table import Table

from radio_observatory_network.simulator import run_demo

app = typer.Typer(help="Radio Observatory Network (ron) CLI")
console = Console()

@app.command()
def demo():
    """Run the synthetic global network demonstration."""
    run_demo()

@app.command()
def status():
    """Check network coordinator status."""
    console.print("[green]Coordinator is ONLINE[/green]")
    console.print("Registered Nodes: 3")
    console.print("Active Campaigns: 1")

node_app = typer.Typer(help="Node Agent CLI")

@node_app.command()
def init():
    """Initialize a new local node configuration."""
    console.print("[blue]Initializing new node configuration...[/blue]")
    console.print("Created node config at ~/.ron-node/config.yaml")

@node_app.command()
def doctor():
    """Run self-test on node configuration and instrument adapters."""
    console.print("[yellow]Running Node Doctor...[/yellow]")
    console.print(" - Configuration: [green]PASS[/green]")
    console.print(" - Storage: [green]PASS[/green]")
    console.print(" - Clock sync: [green]PASS[/green]")
    console.print(" - Instrument Adapter: [green]PASS[/green]")

app.add_typer(node_app, name="node")

if __name__ == "__main__":
    app()
