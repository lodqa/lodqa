require_relative '../tuilookup'
require 'spec_helper'

# @valid_semantic_types_file = "semanticTypes.xml"
# @valid_semantic_types_file = "../semanticTypes.xml"
@valid_semantic_types_file = "./semanticTypes.xml"
@invalid_semantic_types_file = "semanticTypesssss.xml"

# These are regression tests for some bugs that I noticed and
# fixed in an earlier version of tuilookup.rb.

describe "TUILookup", "regression testing of old bugs" do
    it "should recognize correct spelling of diagnostic aid" do
        # t = TUILookup.new(@valid_semantic_types_file)
        t = TUILookup.new("semanticTypes.xml")
        t.lookup("diagnostic aid").should eql (["T130"])
    end
    it "should recognize correct spelling of biogenic amine" do
        # t = TUILookup.new(@valid_semantic_types_file)
        t = TUILookup.new("semanticTypes.xml")
        t.lookup("biogenic amine").should eql (["T124"])
    end
end

# These are regular functionality tests
 
describe "TUILookup", "basic functionality" do
    it "should return correct results for just a single TUI" do
        t = TUILookup.new("semanticTypes.xml")
        t.lookup("gene").should eql (["T028"])
    end
    it "should return correct results for multiple TUIs"
    it "should handle situation correctly if no TUIs are found" do
        t = TUILookup.new("semanticTypes.xml")
        t.lookup("xxxx").should eql ([])
    end
    it "should handle mixed case input" do
       t = TUILookup.new("semanticTypes.xml")
       t.lookup("Gene").should eql (["T028"])
    end   
    it "should handle upper-case input" do
       t = TUILookup.new("semanticTypes.xml")
       t.lookup("GENE").should eql (["T028"])	 
    end   
    it "should handle lower-case input" do
       t = TUILookup.new("semanticTypes.xml")
       t.lookup("gene").should eql (["T028"])
    end
    it "should handle leading and trailing whitespace" do
       t = TUILookup.new("semanticTypes.xml")
       t.lookup(" gene ").should eql (["T028"]) 
    end
end

# These are error-handling tests

describe "TUILookup", "error handling" do
    it "should handle nonexistent input file" do
    expect { TUILookup.new("nonexistent input file name") }.to raise_error
    end
    it "should handle null file name" do
        null_filename = nil
        expect { TUILookup.new(null_filename) }.to raise_error
    end
    it "should handle empty file name" do
        empty_filename = ""
        expect { TUILookup.new(empty_filename) }.to raise_error
    end
    it "should handle null input to lookup" do
        t = TUILookup.new("semanticTypes.xml")
        word = nil
        t.lookup(word).should eql([])
        # I'm not sure that this is the best way to handle this--
        # it's probably better to throw an exception
    end
    it "should handle empty input to lookup" do
        t = TUILookup.new("semanticTypes.xml")
	word = ""
        t.lookup(word).should eql([])
	# I'm not sure that this is the best way to handle this--
        # it's probably better to throw an exception
    end
end
