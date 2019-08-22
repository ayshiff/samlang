@file:JvmName(name = "Main")

package samlang

import com.github.ajalt.clikt.core.subcommands
import samlang.cli.CompileCommand
import samlang.cli.RootCommand
import samlang.cli.ServerCommand
import samlang.cli.TypeCheckCommand

/**
 * Entry point of samlang language service.
 */
fun main(args: Array<String>): Unit =
    RootCommand().subcommands(TypeCheckCommand(), CompileCommand(), ServerCommand()).main(args)
